/**
 * Semantic-aware chunking for biomedical literature.
 * Splits text into meaningful chunks by section, preserving context.
 */
class ChunkingService {
  /**
   * Chunk a paper by its sections (Abstract, Introduction, Methods, Results, Discussion).
   * This preserves semantic boundaries and improves retrieval quality.
   */
  static chunkBySection(paper) {
    const chunks = [];

    if (paper.abstract) {
      chunks.push({
        id: `${paper.paperId}-abstract`,
        paperId: paper.paperId,
        text: paper.abstract,
        section: 'abstract',
        title: paper.title,
        journal: paper.journal,
        publicationYear: paper.publicationYear,
        entityId: paper.entityId,
      });
    }

    // If full text is available, chunk by paragraphs
    if (paper.fullText) {
      const sections = this.splitIntoSections(paper.fullText);
      for (const [sectionName, sectionText] of Object.entries(sections)) {
        const paragraphs = this.splitIntoParagraphs(sectionText);
        paragraphs.forEach((para, idx) => {
          if (para.trim().length > 50) {
            chunks.push({
              id: `${paper.paperId}-${sectionName}-${idx}`,
              paperId: paper.paperId,
              text: para.trim(),
              section: sectionName,
              title: paper.title,
              journal: paper.journal,
              publicationYear: paper.publicationYear,
              entityId: paper.entityId,
            });
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Simple chunking by fixed size with overlap.
   * Used as fallback when section detection fails.
   */
  static chunkBySize(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    let start = 0;
    let idx = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.slice(start, end).trim();

      if (chunkText.length > 50) {
        chunks.push({
          id: `chunk-${idx}`,
          text: chunkText,
          section: 'unknown',
        });
        idx++;
      }

      start += chunkSize - overlap;
    }

    return chunks;
  }

  static splitIntoSections(text) {
    const sections = {};
    const sectionPatterns = [
      { name: 'introduction', pattern: /(?:introduction|background)/i },
      { name: 'methods', pattern: /(?:methods|materials and methods|methodology)/i },
      { name: 'results', pattern: /(?:results|findings)/i },
      { name: 'discussion', pattern: /(?:discussion|conclusions?)/i },
    ];

    // Simple implementation – in production, use a proper section detector
    sections.unknown = text;
    return sections;
  }

  static splitIntoParagraphs(text) {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}

module.exports = ChunkingService;