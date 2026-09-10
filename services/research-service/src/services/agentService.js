/**
 * Agent Service – Multi-agent research workflow with:
 *   - Real graph context (Neo4j)
 *   - Multi-hop graph traversal (D.3)
 *   - Query expansion for better recall (D.1)
 *   - PubMed integration
 *   - Hybrid vector search (Qdrant: dense + sparse BM25)
 *   - Cross-encoder re-ranking
 *   - LLM reasoning with heuristic fallback
 *   - Citation verification (D.2)
 */

const VectorService = require('./vectorService');
const PubMedService = require('./pubmedService');
const rerankerService = require('./rerankerService');
const Neo4jService = require('./neo4jService');
const QueryExpansionService = require('./queryExpansionService');
const CitationVerificationService = require('./citationVerificationService');
const OpenAI = require('openai');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

class AgentService {
  // ============================================================
  // 1. PLANNER AGENT
  // ============================================================
  static async planner(question, entityId, filters = {}) {
    console.log(`🧠 Planner: "${question}"`);

    const q = question.toLowerCase();
    const tasks = [];
    const multiHop = this.detectMultiHop(q);

    if (multiHop.isMultiHop) {
      tasks.push({ type: 'multi_hop_graph', priority: 'high', chain: multiHop.chain, target: multiHop.target });
    } else if (q.includes('drug') && (q.includes('pathway') || q.includes('target'))) {
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

    tasks.push({ type: 'literature_search', priority: 'high', query: question });
    tasks.push({ type: 'vector_search', priority: 'medium', query: `${question} biomedical evidence` });

    return {
      agent: 'Planner',
      status: 'completed',
      output: {
        plan: tasks,
        taskCount: tasks.length,
        multiHop: multiHop.isMultiHop,
        focus: 'graph + literature + rerank + verify',
        originalQuestion: question,
        entityId,
        filters: filters || {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect whether the question requires multi-hop traversal.
   * Heuristic: contains two of {drug, pathway, protein, mutation, disease} AND has a chain hint.
   */
  static detectMultiHop(q) {
    const hasDrug = q.includes('drug');
    const hasPathway = q.includes('pathway');
    const hasProtein = q.includes('protein');
    const hasMutation = q.includes('mutation');
    const hasDisease = q.includes('disease');

    // Multi-hop patterns
    if (hasDrug && hasPathway) {
      return {
        isMultiHop: true,
        chain: ['ENCODES', 'INVOLVED_IN'],
        target: 'DRUG',
        reason: 'drug + pathway',
      };
    }
    if (hasMutation && (hasDrug || hasPathway)) {
      return {
        isMultiHop: true,
        chain: ['ENCODES', 'INVOLVED_IN'],
        target: 'DRUG',
        reason: 'mutation + drug/pathway',
      };
    }
    if (hasProtein && hasDisease) {
      return {
        isMultiHop: true,
        chain: ['ENCODES'],
        target: 'DISEASE',
        reason: 'protein + disease',
      };
    }

    return { isMultiHop: false };
  }

  // ============================================================
  // 2. GRAPH AGENT
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
  // 3a. MULTI-HOP AGENT (D.3)
  // ============================================================
  static async multiHopAgent(entityId, chain, targetType) {
    console.log(`🔗 Multi-hop: chain=${chain.join(' → ')}, target=${targetType}`);

    if (!entityId) {
      return {
        agent: 'MultiHop',
        status: 'failed',
        output: { error: 'No entityId provided', results: [] },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const results = await Neo4jService.multiHopTraversal(entityId, chain, targetType);
      console.log(`   ✅ Found ${results.length} multi-hop results`);

      return {
        agent: 'MultiHop',
        status: 'completed',
        output: {
          chain,
          targetType,
          results,
          count: results.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error('   🔗 Multi-hop failed:', err.message);
      return {
        agent: 'MultiHop',
        status: 'failed',
        output: { error: err.message, results: [] },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================
  // 3b. LITERATURE AGENT (with query expansion)
  // ============================================================
  static async literatureAgent(question, graphContext, filters = {}) {
    console.log(`📄 Literature: Starting retrieval for "${question}"`);

    let allChunks = [];
    const metadata = {
      pubmedCount: 0,
      qdrantCount: 0,
      uniqueCount: 0,
      rerankedCount: 0,
      queryVariants: 1,
      filtersApplied: Object.keys(filters).length > 0,
      filtersUsed: filters,
    };

    // ---------- (D.1) Query expansion ----------
    let queries = [question];
    try {
      queries = await QueryExpansionService.expand(question, 3);
      metadata.queryVariants = queries.length;
      console.log(`   🧠 Query expansion: ${queries.length} variants`);
      queries.forEach((q, i) => console.log(`      ${i + 1}. ${q.slice(0, 80)}${q.length > 80 ? '…' : ''}`));
    } catch (err) {
      console.warn('   🧠 Query expansion failed:', err.message);
    }

    // ---------- (a) PubMed for the original question ----------
    try {
      const pubmedChunks = await PubMedService.search(question, 10);
      if (pubmedChunks.length > 0) {
        console.log(`   📄 Indexing ${pubmedChunks.length} PubMed results into Qdrant...`);
        try {
          await VectorService.upsertChunks(pubmedChunks);
        } catch (idxErr) {
          console.warn('   ⚠️  PubMed indexing failed:', idxErr.message);
        }
        allChunks = allChunks.concat(pubmedChunks);
        metadata.pubmedCount = pubmedChunks.length;
      }
    } catch (err) {
      console.error('   📄 PubMed search failed:', err.message);
    }

    // ---------- (b) Qdrant hybrid search for each variant ----------
    try {
      const qdrantFilter = this.buildQdrantFilter(filters);
      const searchPromises = queries.map(q =>
        VectorService.hybridSearch(q, 10, qdrantFilter).catch(err => {
          console.warn(`   📄 Variant search failed for "${q.slice(0, 50)}":`, err.message);
          return [];
        })
      );
      const resultsPerQuery = await Promise.all(searchPromises);
      const flat = resultsPerQuery.flat();
      allChunks = allChunks.concat(flat);
      metadata.qdrantCount = flat.length;
      console.log(`   📄 Hybrid search across variants: ${flat.length} chunks`);
    } catch (err) {
      console.error('   📄 Hybrid search failed:', err.message);
    }

    // ---------- (c) De-duplicate ----------
    const uniqueChunks = Array.from(
      new Map(allChunks.map(chunk => [chunk.id || chunk.qdrantId, chunk])).values()
    );
    metadata.uniqueCount = uniqueChunks.length;
    console.log(`   📄 Total unique chunks: ${uniqueChunks.length}`);

    // ---------- (d) Re-rank ----------
    let rerankedChunks = uniqueChunks.slice(0, 5);
    try {
      rerankedChunks = await rerankerService.rank(question, uniqueChunks, 5);
      metadata.rerankedCount = rerankedChunks.length;
    } catch (err) {
      console.error('   🎯 Reranker failed:', err.message);
    }

    // ---------- (e) Structured output ----------
    const papers = rerankedChunks.map(c => ({
      id: c.id || c.qdrantId,
      title: c.title || 'Untitled',
      snippet: (c.text || '').slice(0, 400),
      journal: c.journal || '',
      year: c.publicationYear || null,
      section: c.section || 'unknown',
      rerankScore: c.rerankScore || null,
      rrfScore: c.score || null,
    }));

    return {
      agent: 'Literature',
      status: 'completed',
      output: {
        papers,
        count: papers.length,
        searchType: 'pubmed + query-expansion + hybrid + rerank',
        metadata,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // 4. REASONING AGENT
  // ============================================================
  static async reasoningAgent(question, graphContext, literature, multiHopResults, evidence) {
    console.log(`🧠 Reasoning: synthesizing answer`);

    const graphText = this.buildGraphContextString(graphContext);
    const literatureText = this.buildLiteratureContextString(literature);
    const multiHopText = this.buildMultiHopContextString(multiHopResults);

    const client = getOpenAI();

    if (client) {
      try {
        const systemPrompt = `You are a biomedical research assistant.
Answer the user's question using ONLY the provided graph facts, multi-hop findings, and literature snippets.
Cite specific entities or paper titles you used.
If the context is insufficient, say so clearly.
Return JSON with keys: "answer" (string), "citations" (array of strings), "confidence" (0-1 number).`;

        const userPrompt = `GRAPH CONTEXT:
${graphText}

${multiHopText ? 'MULTI-HOP FINDINGS:\n' + multiHopText + '\n\n' : ''}LITERATURE CONTEXT:
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

        const parsed = JSON.parse(response.choices[0].message.content);

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

    return this.heuristicReasoning(question, graphContext, literature, multiHopResults);
  }

  static heuristicReasoning(question, graphContext, literature, multiHopResults) {
    const nodes = graphContext.nodes || [];
    const papers = literature.papers || [];
    const multiHop = multiHopResults?.results || [];

    const drugs = nodes.filter(n => n.type === 'DRUG').map(n => n.name);
    const proteins = nodes.filter(n => n.type === 'PROTEIN').map(n => n.name);
    const pathways = nodes.filter(n => n.type === 'PATHWAY').map(n => n.name);
    const genes = nodes.filter(n => n.type === 'GENE').map(n => n.name);
    const diseases = nodes.filter(n => n.type === 'DISEASE').map(n => n.name);

    let answer = '';
    if (multiHop.length > 0) {
      const drugNames = [...new Set(multiHop.map(r => r.target).filter(Boolean))];
      answer = `Multi-hop analysis reveals ${drugNames.length} potential drug target(s): ${drugNames.join(', ')}. `;
    } else if (drugs.length && proteins.length && pathways.length) {
      answer = `${drugs.join(', ')} target(s) ${proteins.join(', ')}, which participate in ${pathways.join(', ')}. `;
    } else if (genes.length && diseases.length) {
      answer = `${genes.join(', ')} is/are associated with ${diseases.join(', ')}. `;
    } else {
      answer = `Based on the graph, relevant entities include: ${nodes.slice(0, 5).map(n => n.name).join(', ')}. `;
    }

    if (papers.length) {
      answer += `Supporting literature includes: "${papers[0].title}".`;
    }

    const confidence = Math.min(
      0.5 + nodes.length * 0.03 + papers.length * 0.04 + (multiHop.length > 0 ? 0.1 : 0),
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
  // 5. EVIDENCE AGENT (with citation verification – D.2)
  // ============================================================
  static async evidenceAgent(answer, citations, graphContext, literature) {
    console.log(`🔍 Evidence: mapping ${citations.length} citations to sources`);

    const nodes = graphContext.nodes || [];
    const papers = literature?.papers || [];

    // Build the source pool: entities + papers
    const sourcePool = [
      ...nodes.map(n => ({ id: n.id, name: n.name, type: 'entity', nodeType: n.type })),
      ...papers.map(p => ({ id: p.id, title: p.title, snippet: p.snippet, type: 'paper' })),
    ];

    // ---- D.2 – Citation verification ----
    let verifications = [];
    try {
      verifications = await CitationVerificationService.verify(answer, citations, sourcePool);
      console.log(`   🧾 Verified ${verifications.length} citations`);
    } catch (err) {
      console.warn('   🧾 Citation verification failed:', err.message);
    }

    const verificationSummary = CitationVerificationService.summarize(verifications);

    // ---- Evidence map (legacy output) ----
    const evidenceMap = citations.map(citation => {
      const verification = verifications.find(v => v.citation === citation);
      const matchedNodes = nodes.filter(n =>
        n.name.toLowerCase().includes(citation.toLowerCase()) ||
        citation.toLowerCase().includes(n.name.toLowerCase())
      );
      const matchedPapers = papers.filter(p =>
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
        supported: verification?.supported ?? (sources.length > 0),
        confidence: verification?.confidence ?? (sources.length > 0 ? 0.7 : 0.3),
      };
    });

    const supportedClaims = evidenceMap.filter(e => e.supported).length;
    const totalClaims = evidenceMap.length || 1;

    const confidence = parseFloat(
      (
        (supportedClaims / totalClaims) * 0.5 +
        verificationSummary.supportRate * 0.3 +
        (nodes.length > 0 ? 0.1 : 0) +
        (papers.length > 0 ? 0.1 : 0)
      ).toFixed(2)
    );

    return {
      agent: 'Evidence',
      status: 'completed',
      output: {
        evidenceMap,
        verifications,
        verificationSummary,
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
  // FULL PIPELINE
  // ============================================================
  static async runPipeline(question, entityId, graphContext, filters = {}) {
    const startTime = Date.now();
    const steps = [];

    console.log(`\n🎬 Agent pipeline starting`);
    console.log(`   Question: ${question}`);
    console.log(`   EntityId: ${entityId}`);
    console.log(`   Filters:  ${JSON.stringify(filters)}`);

    // 1. Planner
    const plannerResult = await this.planner(question, entityId, filters);
    steps.push(plannerResult);

    // 2. Graph (fetch from Neo4j if not provided)
    let effectiveGraph = graphContext;
    if ((!graphContext.nodes || graphContext.nodes.length === 0) && entityId) {
      try {
        effectiveGraph = await Neo4jService.getGraph(entityId, 2);
      } catch (err) {
        console.warn('   📊 Neo4j graph fetch failed:', err.message);
      }
    }
    const graphResult = await this.graphAgent(entityId, effectiveGraph);
    steps.push(graphResult);

    // 3. Multi-hop (conditionally, based on planner)
    const multiHopTask = plannerResult.output.plan.find(t => t.type === 'multi_hop_graph');
    let multiHopResult = null;
    if (multiHopTask && entityId) {
      multiHopResult = await this.multiHopAgent(entityId, multiHopTask.chain, multiHopTask.target);
      steps.push(multiHopResult);
    }

    // 4. Literature
    const literatureResult = await this.literatureAgent(question, effectiveGraph, filters);
    steps.push(literatureResult);

    // 5. Reasoning
    const reasoningResult = await this.reasoningAgent(
      question,
      effectiveGraph,
      literatureResult.output,
      multiHopResult?.output,
      {}
    );
    steps.push(reasoningResult);

    // 6. Evidence + verification
    const evidenceResult = await this.evidenceAgent(
      reasoningResult.output.answer,
      reasoningResult.output.citations,
      effectiveGraph,
      literatureResult.output
    );
    steps.push(evidenceResult);

    // Combine confidences
    const reasoningConf = reasoningResult.output.confidence || 0.7;
    const evidenceConf = evidenceResult.output.confidence || 0.7;
    const finalConfidence = parseFloat(
      (reasoningConf * 0.4 + evidenceConf * 0.6).toFixed(2)
    );

    const duration = Date.now() - startTime;

    const finalOutput = {
      answer: reasoningResult.output.answer,
      citations: reasoningResult.output.citations,
      confidence: finalConfidence,
      metadata: {
        duration_ms: duration,
        graphNodes: effectiveGraph.nodes?.length || 0,
        graphEdges: effectiveGraph.edges?.length || 0,
        multiHopUsed: !!multiHopResult,
        multiHopResults: multiHopResult?.output?.count || 0,
        literatureChunks: literatureResult.output.papers?.length || 0,
        pubmedCount: literatureResult.output.metadata?.pubmedCount || 0,
        qdrantCount: literatureResult.output.metadata?.qdrantCount || 0,
        uniqueChunks: literatureResult.output.metadata?.uniqueCount || 0,
        rerankedCount: literatureResult.output.metadata?.rerankedCount || 0,
        queryVariants: literatureResult.output.metadata?.queryVariants || 1,
        reasoningSource: reasoningResult.output.source || 'unknown',
        supportedClaims: evidenceResult.output.supportedClaims,
        totalClaims: evidenceResult.output.totalClaims,
        citationSupportRate: evidenceResult.output.verificationSummary?.supportRate || 0,
        hallucinationRate: evidenceResult.output.verificationSummary?.hallucinationRate || 0,
        filtersApplied: literatureResult.output.metadata?.filtersApplied || false,
      },
    };

    console.log(`🎬 Pipeline complete in ${duration}ms (confidence: ${finalConfidence})\n`);

    return { steps, finalOutput };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  static buildGraphContextString(graphContext) {
    const nodes = graphContext.nodes || [];
    const edges = graphContext.edges || [];
    const lines = ['Entities:'];
    nodes.forEach(n => lines.push(`  - ${n.name} (${n.type})`));
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
    return papers.slice(0, 5).map((p, i) => {
      const year = p.year ? `, ${p.year}` : '';
      const journal = p.journal ? ` (${p.journal}${year})` : '';
      return `[${i + 1}] "${p.title}"${journal}\n    ${p.snippet || '(no snippet)'}`;
    }).join('\n\n');
  }

  static buildMultiHopContextString(multiHopOutput) {
    if (!multiHopOutput || !multiHopOutput.results || multiHopOutput.results.length === 0) {
      return '';
    }
    const lines = [`Chain: ${multiHopOutput.chain?.join(' → ')} → ${multiHopOutput.targetType}`];
    multiHopOutput.results.slice(0, 5).forEach(r => {
      lines.push(`  ${r.start} → ${r.intermediate} (${r.intermediateType}) → ${r.target || 'N/A'}`);
    });
    return lines.join('\n');
  }

  static buildQdrantFilter(filters = {}) {
    if (!filters || Object.keys(filters).length === 0) return null;
    const must = [];
    if (filters.journal) must.push({ key: 'journal', match: { value: filters.journal } });
    if (filters.section) must.push({ key: 'section', match: { value: filters.section } });
    if (filters.paperId) must.push({ key: 'paperId', match: { value: filters.paperId } });
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