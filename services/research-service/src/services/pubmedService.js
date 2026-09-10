require('dotenv').config();
const axios = require('axios');

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL = process.env.NCBI_TOOL || 'biograph-research-platform';
const EMAIL = process.env.NCBI_EMAIL || 'test@example.com';
const API_KEY = process.env.NCBI_API_KEY || '';

/**
 * Minimal XML tag extractor.
 * We only need a handful of fields from PubMed's XML response.
 */
function extractTag(xml, tag) {
  if (!xml) return '';
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractAllTags(xml, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

class PubMedService {
  /**
   * Search PubMed for a question and return normalized chunks.
   * @param {string} question - The user's research question.
   * @param {number} maxResults - Max articles to return (default 10).
   * @returns {Promise<Array>} - Normalized paper chunks.
   */
  static async search(question, maxResults = 10) {
    console.log(`   🩺 PubMed: Searching for "${question}"`);

    const searchTerm = question.replace(/[?]/g, '').trim();

    try {
      // ---------- 1. ESearch: get PMIDs ----------
      const searchParams = {
        db: 'pubmed',
        term: searchTerm,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
        tool: TOOL,
        email: EMAIL,
      };
      if (API_KEY) searchParams.api_key = API_KEY;

      const searchRes = await axios.get(`${EUTILS_BASE}/esearch.fcgi`, {
        params: searchParams,
        timeout: 15000,
      });

      const pmids = searchRes.data?.esearchresult?.idlist || [];
      if (pmids.length === 0) {
        console.log('   🩺 PubMed: No results found.');
        return [];
      }

      console.log(`   🩺 PubMed: Found ${pmids.length} PMIDs, fetching details...`);

      // ---------- 2. EFetch: get abstracts ----------
      const fetchParams = {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'xml',
        rettype: 'abstract',
        tool: TOOL,
        email: EMAIL,
      };
      if (API_KEY) fetchParams.api_key = API_KEY;

      const fetchRes = await axios.get(`${EUTILS_BASE}/efetch.fcgi`, {
        params: fetchParams,
        timeout: 20000,
      });

      const xml = fetchRes.data;
      const articleBlocks = extractAllTags(xml, 'PubmedArticle');

      // ---------- 3. Parse each article ----------
      const chunks = [];
      for (const block of articleBlocks) {
        const pmid = extractTag(block, 'PMID');
        const title = extractTag(block, 'ArticleTitle');
        const journal = extractTag(block, 'Title');
        const abstract = extractAllTags(block, 'AbstractText').join(' ');
        const yearMatch = block.match(/<Year>(\d{4})<\/Year>/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

        // Extract DOI
        const doiMatch = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
        const doi = doiMatch ? doiMatch[1] : null;

        const fullText = `${title}. ${abstract}`.trim();
        if (fullText.length < 30) continue; // skip empty records

        chunks.push({
          id: `pubmed-${pmid}`,
          paperId: pmid,
          title: title || 'Untitled',
          abstract: abstract || 'No abstract available.',
          text: fullText,
          journal: journal || '',
          publicationYear: year,
          doi,
          section: 'abstract',
          metadata: { source: 'pubmed' },
        });
      }

      console.log(`   🩺 PubMed: Retrieved ${chunks.length} articles.`);
      return chunks;
    } catch (error) {
      console.error('   🩺 PubMed: Search error:', error.message);
      return [];
    }
  }
}

module.exports = PubMedService;