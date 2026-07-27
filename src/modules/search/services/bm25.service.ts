import { Injectable, Logger } from '@nestjs/common';
import { SearchResultChunk } from '../interfaces/search-result.interface';

interface IndexedDocument {
  id: string;
  chunk: SearchResultChunk;
  tokens: string[];
  docLength: number;
  termFrequencies: Map<string, number>;
}

@Injectable()
export class BM25Service {
  private readonly logger = new Logger(BM25Service.name);
  private documents: IndexedDocument[] = [];
  private avgDocLength: number = 0;
  private totalDocs: number = 0;
  private docFrequencies: Map<string, number> = new Map();

  // Okapi BM25 Parameters
  private readonly k1: number = 1.2;
  private readonly b: number = 0.75;

  /**
   * Tokenizes text into normalized lowercase alphanumeric terms.
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2); // Exclude very short stop words
  }

  /**
   * Clears existing index and builds BM25 inverse document matrix.
   */
  indexDocuments(chunks: SearchResultChunk[]): void {
    this.documents = [];
    this.docFrequencies.clear();
    let totalLength = 0;

    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.text);
      const docLength = tokens.length;
      totalLength += docLength;

      const termFrequencies = new Map<string, number>();
      const uniqueTokens = new Set<string>();

      for (const token of tokens) {
        termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
        uniqueTokens.add(token);
      }

      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
      }

      this.documents.push({
        id: chunk.id,
        chunk,
        tokens,
        docLength,
        termFrequencies,
      });
    }

    this.totalDocs = this.documents.length;
    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
    this.logger.log(`BM25 Index built with ${this.totalDocs} documents. Avg length: ${this.avgDocLength.toFixed(1)} tokens.`);
  }

  /**
   * Performs BM25 scoring for query terms and returns Top N matching chunks.
   */
  search(query: string, topK: number = 10): SearchResultChunk[] {
    if (this.totalDocs === 0) {
      this.logger.warn('BM25 search called on empty index.');
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scoredDocs: { chunk: SearchResultChunk; score: number }[] = [];

    for (const doc of this.documents) {
      let score = 0;

      for (const qToken of queryTokens) {
        const tf = doc.termFrequencies.get(qToken) || 0;
        if (tf === 0) continue;

        const df = this.docFrequencies.get(qToken) || 0;
        // IDF calculation with smoothing
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

        // BM25 term weight formula
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLength / (this.avgDocLength || 1)));

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        // Clone chunk and attach BM25 score
        scoredDocs.push({
          chunk: {
            ...doc.chunk,
            metadata: {
              ...doc.chunk.metadata,
              bm25Score: score,
            },
          },
          score,
        });
      }
    }

    // Sort descending by BM25 score
    scoredDocs.sort((a, b) => b.score - a.score);

    this.logger.log(`BM25 Search found ${scoredDocs.length} matching candidates for query: "${query}"`);
    return scoredDocs.slice(0, topK).map((item) => item.chunk);
  }
}
