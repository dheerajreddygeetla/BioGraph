/**
 * Agent Service – Multi‑agent research workflow with:
 *   - Real graph context (Neo4j)
 *   - PubMed integration (real-time paper fetching)
 *   - Local hybrid vector search (Qdrant: dense + sparse BM25)
 *   - Cross-encoder re-ranking
 *   - Metadata filtering
 *   - LLM reasoning with heuristic fallback
 */

const VectorService = require('./vectorService');
const PubMedService = require('./pubmedService');
const rerankerService = require('./rerankerService');
const OpenAI = require('openai');

// Lazy-init OpenAI to avoid crashing when key is missing
let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

class AgentService {
  // ============================================================
  // 1. PLANNER AGENT – decomposes the question into tasks
  // ============================================================
  static async planner(question, entityId, filters = {}) {
    console.log(`🧠 Planner: "${question}"`);
    if (Object.keys(filters).length > 0) {
      console.log(`   🎯 Filters: ${JSON.stringify(filters)}`);
    }

    const q = question.toLowerCase();
    const tasks = [];

    if (q.includes('drug') && (q.includes('pathway') || q.includes('target'))) {
      tasks.push({ type: 'graph_pathway_drugs', priority: 'high' });
    }
    if (q.includes('clinical trial') || q.includes('trial')) {
      tasks.push({ type: 'graph_clinical_trials', priority: 'high' });
    }
    if (q.includes('protein') || q.includes('encode')) {
      tasks.push({ type: 'graph_protein_lookup', priority: 'medium' });
    }
    if (q.includes('pathway')) {
      tasks.push({ type: 'graph_pathway_lookup', priority: 'medium' });
    }

    // Literature search tasks
    tasks.push({ type: 'literature_search', priority: 'high', query: question });
    tasks.push({ type: 'vector_search', priority: 'medium', query: `${question} biomedical evidence` });

    return {
      agent: 'Planner',
      status: 'completed',
      output: {
        plan: tasks,
        taskCount: tasks.length,
        focus: 'graph + literature + rerank',
        originalQuestion: question,
        entityId,
        filters: filters || {},
        hasFilters: Object.keys(filters || {}).length > 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // 2. GRAPH AGENT – reports graph context (fetched by worker)
  // ============================================================
  static async graphAgent(entityId, graphContext) {
    console.log(`📊 Graph: ${graphContext.nodes?.length || 0} nodes`);

    return {
      agent: 'Graph',
      status: 'completed',
      output: {
        nodeCount: graphContext.nodes?.length || 0,
        edgeCount: graphContext.edges?.length || 0,
        nodes: (graphContext.nodes || []).map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
        })),
        edges: (graphContext.edges || []).map(e => ({
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // 3. LITERATURE AGENT – PubMed + Qdrant hybrid + Re-ranking
  // ============================================================
  static async literatureAgent(question, graphContext, filters = {}) {
    console.log(`📄 Literature: Starting retrieval for "${question}"`);
    if (Object.keys(filters).length > 0) {
      console.log(`   🎯 Applying filters: ${JSON.stringify(filters)}`);
    }

    let allChunks = [];
    const metadata = {
      pubmedCount: 0,
      qdrantCount: 0,
      uniqueCount: 0,
      rerankedCount: 0,
      filtersApplied: Object.keys(filters).length > 0,
      filtersUsed: filters,
    };

    // ---------- (a) PubMed fetch + index into Qdrant ----------
    try {
      const pubmedChunks = await PubMedService.search(question, 10);
      if (pubmedChunks.length > 0) {
        console.log(`   📄 Indexing ${pubmedChunks.length} PubMed results into Qdrant...`);
        try {
          await VectorService.upsertChunks(pubmedChunks);
          console.log('   📄 PubMed indexing complete.');
        } catch (idxErr) {
          console.warn('   ⚠️  PubMed indexing failed:', idxErr.message);
        }
        allChunks = allChunks.concat(pubmedChunks);
        metadata.pubmedCount = pubmedChunks.length;
      }
    } catch (error) {
      console.error('   📄 PubMed search failed:', error.message);
    }

    // ---------- (b) Hybrid vector search (local Qdrant) ----------
    try {
      const qdrantFilter = this.buildQdrantFilter(filters);
      const qdrantChunks = await VectorService.hybridSearch(question, 15, qdrantFilter);
      allChunks = allChunks.concat(qdrantChunks);
      metadata.qdrantCount = qdrantChunks.length;
      console.log(`   📄 Hybrid search returned ${qdrantChunks.length} chunks.`);
    } catch (error) {
      console.error('   📄 Hybrid search failed:', error.message);
    }

    // ---------- (c) De-duplicate ----------
    const uniqueChunks = Array.from(
      new Map(allChunks.map(chunk => [chunk.id || chunk.qdrantId, chunk])).values()
    );
    metadata.uniqueCount = uniqueChunks.length;
    console.log(`   📄 Total unique chunks: ${uniqueChunks.length}`);

    // ---------- (d) Re-rank with cross-encoder ----------
    let rerankedChunks = uniqueChunks.slice(0, 5);
    try {
      rerankedChunks = await rerankerService.rank(question, uniqueChunks, 5);
      metadata.rerankedCount = rerankedChunks.length;
    } catch (error) {
      console.error('   🎯 Reranker failed, using top-5 by RRF:', error.message);
    }

    // ---------- (e) Return structured output ----------
    const papers = rerankedChunks.map(c => ({
      id: c.id || c.qdrantId,
      title: c.title || 'Untitled',
      snippet: (c.text || '').slice(0, 400),
      journal: c.journal || '',
      year: c.publicationYear || null,
      section: c.section || 'unknown',
      rerankScore: c.rerankScore || null,
      rrfScore: c.score || null,
      denseScore: c.denseScore || null,
      sparseScore: c.sparseScore || null,
    }));

    return {
      agent: 'Literature',
      status: 'completed',
      output: {
        papers,
        count: papers.length,
        searchType: 'pubmed + qdrant-hybrid + cross-encoder-rerank',
        metadata,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // 4. REASONING AGENT – LLM synthesis with heuristic fallback
  // ============================================================
  static async reasoningAgent(question, graphContext, literature, evidence) {
    console.log(`🧠 Reasoning: synthesizing answer`);

    const graphText = this.buildGraphContextString(graphContext);
    const literatureText = this.buildLiteratureContextString(literature);

    const client = getOpenAI();

    if (client) {
      try {
        const systemPrompt = `You are a biomedical research assistant.
Answer the user's question using ONLY the provided graph facts and literature snippets.
Cite specific entities or paper titles you used.
If the context is insufficient, say so clearly.
Return JSON with keys: "answer" (string), "citations" (array of strings), "confidence" (0-1 number).`;

        const userPrompt = `GRAPH CONTEXT:
${graphText}

LITERATURE CONTEXT:
${literatureText}

QUESTION: ${question}`;

        const response = await client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);

        return {
          agent: 'Reasoning',
          status: 'completed',
          output: {
            answer: parsed.answer || 'No answer generated.',
            citations: parsed.citations || [],
            confidence: parsed.confidence || 0.7,
            source: 'llm',
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.warn('LLM reasoning failed, falling back:', error.message);
      }
    }

    return this.heuristicReasoning(question, graphContext, literature);
  }

  static heuristicReasoning(question, graphContext, literature) {
    const nodes = graphContext.nodes || [];
    const papers = literature.papers || [];

    const genes = nodes.filter(n => n.type === 'GENE').map(n => n.name);
    const proteins = nodes.filter(n => n.type === 'PROTEIN').map(n => n.name);
    const drugs = nodes.filter(n => n.type === 'DRUG').map(n => n.name);
    const pathways = nodes.filter(n => n.type === 'PATHWAY').map(n => n.name);
    const diseases = nodes.filter(n => n.type === 'DISEASE').map(n => n.name);

    let answer = `Based on the graph and ${papers.length} literature snippets, `;
    if (drugs.length && proteins.length && pathways.length) {
      answer += `${drugs.join(', ')} target(s) ${proteins.join(', ')}, which participate in ${pathways.join(', ')}. `;
    } else if (genes.length && diseases.length) {
      answer += `${genes.join(', ')} is/are associated with ${diseases.join(', ')}. `;
    } else {
      answer += `the following entities are relevant: ${nodes.map(n => n.name).slice(0, 5).join(', ')}. `;
    }

    if (papers.length) {
      answer += `Supporting literature includes: "${papers[0].title}".`;
    }

    const confidence = Math.min(
      0.5 + nodes.length * 0.03 + papers.length * 0.04,
      0.95
    );

    const citations = [
      ...nodes.slice(0, 4).map(n => n.name),
      ...papers.slice(0, 2).map(p => p.title),
    ];

    return {
      agent: 'Reasoning',
      status: 'completed',
      output: {
        answer,
        citations,
        confidence: parseFloat(confidence.toFixed(2)),
        source: 'heuristic',
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // 5. EVIDENCE AGENT – maps claims to sources
  // ============================================================
  static async evidenceAgent(answer, citations, graphContext, literature) {
    console.log(`🔍 Evidence: mapping ${citations.length} citations to sources`);

    const nodes = graphContext.nodes || [];
    const papers = literature?.papers || [];

    const evidenceMap = citations.map(citation => {
      const matchedNodes = nodes.filter(
        n =>
          n.name.toLowerCase().includes(citation.toLowerCase()) ||
          citation.toLowerCase().includes(n.name.toLowerCase())
      );

      const matchedPapers = papers.filter(
        p =>
          p.title.toLowerCase().includes(citation.toLowerCase()) ||
          citation.toLowerCase().includes(p.title.toLowerCase())
      );

      const sources = [
        ...matchedNodes.map(n => ({ type: 'entity', name: n.name, nodeType: n.type })),
        ...matchedPapers.map(p => ({ type: 'paper', title: p.title, journal: p.journal })),
      ];

      return {
        claim: citation,
        sources,
        sourceCount: sources.length,
        supported: sources.length > 0,
      };
    });

    const supportedClaims = evidenceMap.filter(e => e.supported).length;
    const totalClaims = evidenceMap.length || 1;
    const graphCoverage = nodes.length > 0 ? 1 : 0;
    const literatureCoverage = papers.length > 0 ? 1 : 0;

    const confidence = parseFloat(
      (
        (supportedClaims / totalClaims) * 0.6 +
        graphCoverage * 0.2 +
        literatureCoverage * 0.2
      ).toFixed(2)
    );

    return {
      agent: 'Evidence',
      status: 'completed',
      output: {
        evidenceMap,
        supportedClaims,
        totalClaims,
        graphSourceCount: nodes.length,
        literatureSourceCount: papers.length,
        confidence,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // FULL PIPELINE – orchestrates all agents (with filters)
  // ============================================================
  static async runPipeline(question, entityId, graphContext, filters = {}) {
    const startTime = Date.now();
    const steps = [];

    console.log(`\n🎬 Starting agent pipeline`);
    console.log(`   Question: ${question}`);
    console.log(`   EntityId: ${entityId}`);
    console.log(`   Filters:  ${JSON.stringify(filters)}`);

    // ---- 1. Planner (receives filters for visibility) ----
    const plannerResult = await this.planner(question, entityId, filters);
    steps.push(plannerResult);

    // ---- 2. Graph (Neo4j context) ----
    const graphResult = await this.graphAgent(entityId, graphContext);
    steps.push(graphResult);

    // ---- 3. Literature (PubMed + Qdrant hybrid + Rerank) ----
    const literatureResult = await this.literatureAgent(question, graphContext, filters);
    steps.push(literatureResult);

    // ---- 4. Reasoning (LLM with fallback) ----
    const reasoningResult = await this.reasoningAgent(
      question,
      graphContext,
      literatureResult.output,
      {}
    );
    steps.push(reasoningResult);

    // ---- 5. Evidence (map claims to sources) ----
    const evidenceResult = await this.evidenceAgent(
      reasoningResult.output.answer,
      reasoningResult.output.citations,
      graphContext,
      literatureResult.output
    );
    steps.push(evidenceResult);

    // ---- Combine confidences ----
    const reasoningConf = reasoningResult.output.confidence || 0.7;
    const evidenceConf = evidenceResult.output.confidence || 0.7;
    const finalConfidence = parseFloat(
      (reasoningConf * 0.4 + evidenceConf * 0.6).toFixed(2)
    );

    const duration = Date.now() - startTime;

    // ---- Final output with filter metadata ----
    const finalOutput = {
      answer: reasoningResult.output.answer,
      citations: reasoningResult.output.citations,
      confidence: finalConfidence,
      metadata: {
        duration_ms: duration,
        graphNodes: graphContext.nodes?.length || 0,
        graphEdges: graphContext.edges?.length || 0,
        literatureChunks: literatureResult.output.papers?.length || 0,
        pubmedCount: literatureResult.output.metadata?.pubmedCount || 0,
        qdrantCount: literatureResult.output.metadata?.qdrantCount || 0,
        uniqueChunks: literatureResult.output.metadata?.uniqueCount || 0,
        rerankedCount: literatureResult.output.metadata?.rerankedCount || 0,
        reasoningSource: reasoningResult.output.source || 'unknown',
        supportedClaims: evidenceResult.output.supportedClaims,
        totalClaims: evidenceResult.output.totalClaims,
        filtersApplied: literatureResult.output.metadata?.filtersApplied || false,
        filtersUsed: literatureResult.output.metadata?.filtersUsed || {},
      },
    };

    console.log(`🎬 Pipeline complete in ${duration}ms (confidence: ${finalConfidence})`);

    return { steps, finalOutput };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  static buildGraphContextString(graphContext) {
    const nodes = graphContext.nodes || [];
    const edges = graphContext.edges || [];

    const lines = [];
    lines.push('Entities:');
    nodes.forEach(n => {
      lines.push(`  - ${n.name} (${n.type})`);
    });

    lines.push('\nRelationships:');
    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.source)?.name || e.source;
      const tgt = nodes.find(n => n.id === e.target)?.name || e.target;
      lines.push(`  - ${src} --[${e.label}]--> ${tgt}`);
    });

    return lines.join('\n');
  }

  static buildLiteratureContextString(literature) {
    const papers = literature.papers || [];
    if (papers.length === 0) return '(no literature retrieved)';

    return papers
      .slice(0, 5)
      .map((p, i) => {
        const year = p.year ? `, ${p.year}` : '';
        const journal = p.journal ? ` (${p.journal}${year})` : '';
        return `[${i + 1}] "${p.title}"${journal}\n    ${p.snippet || '(no snippet)'}`;
      })
      .join('\n\n');
  }

  /**
   * Build a Qdrant filter object from frontend filters.
   * Supported filters:
   *   - journal (string)       – exact match on journal name
   *   - yearFrom (number)      – publicationYear >= yearFrom
   *   - yearTo (number)        – publicationYear <= yearTo
   *   - section (string)       – exact match on section (abstract, methods, etc.)
   *   - paperId (string)       – restrict to a specific paper
   */
  static buildQdrantFilter(filters = {}) {
    if (!filters || Object.keys(filters).length === 0) return null;

    const must = [];

    if (filters.journal) {
      must.push({ key: 'journal', match: { value: filters.journal } });
    }
    if (filters.section) {
      must.push({ key: 'section', match: { value: filters.section } });
    }
    if (filters.paperId) {
      must.push({ key: 'paperId', match: { value: filters.paperId } });
    }

    if (filters.yearFrom || filters.yearTo) {
      const range = {};
      if (filters.yearFrom) range.gte = parseInt(filters.yearFrom, 10);
      if (filters.yearTo) range.lte = parseInt(filters.yearTo, 10);
      must.push({ key: 'publicationYear', range });
    }

    return must.length > 0 ? { must } : null;
  }
}

module.exports = AgentService;