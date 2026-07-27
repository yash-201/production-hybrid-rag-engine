import { Injectable, Logger } from '@nestjs/common';
import { IRerankProvider } from '../interfaces/rerank-provider.interface';
import { SearchResultChunk } from '../interfaces/search-result.interface';

@Injectable()
export class CustomRerankProvider implements IRerankProvider {
  private readonly logger = new Logger(CustomRerankProvider.name);

  async rerank(
    query: string,
    chunks: SearchResultChunk[],
    topK: number = 5
  ): Promise<SearchResultChunk[]> {
    if (!chunks || chunks.length === 0) return [];

    this.logger.log(`Executing Custom Multi-Factor Re-ranking on ${chunks.length} chunks...`);

    const queryTerms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Find max raw BM25 score for normalization
    const maxBm25 = Math.max(...chunks.map((c) => c.metadata.bm25Score || 0), 1.0);

    const rescored = chunks.map((chunk) => {
      // Factor 1: Semantic Similarity Score (0 to 1)
      const semanticSimilarity = chunk.metadata.vectorScore ?? 0.5;

      // Factor 2: Keyword Match Score (Normalized BM25 + Term Coverage ratio)
      const rawBm25 = chunk.metadata.bm25Score || 0;
      const normalizedBm25 = rawBm25 / maxBm25;

      const chunkLower = chunk.text.toLowerCase();
      let matchedTerms = 0;
      for (const term of queryTerms) {
        if (chunkLower.includes(term)) matchedTerms++;
      }
      const termCoverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;
      const keywordMatch = 0.6 * normalizedBm25 + 0.4 * termCoverage;

      // Factor 3: Metadata Quality Score (Length suitability, chunk position ratio)
      const lengthScore = Math.min(1.0, chunk.text.length / 500);
      const positionBonus = chunk.metadata.chunkIndex === 0 ? 0.1 : 0.0;
      const metadataQuality = Math.min(1.0, lengthScore * 0.9 + positionBonus);

      // Weighted Total Rerank Score
      // 55% Semantic Similarity, 35% Keyword Match, 10% Metadata Quality
      const rerankScore =
        0.55 * semanticSimilarity + 0.35 * keywordMatch + 0.1 * metadataQuality;

      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          rerankScore,
          rankFactors: {
            semanticSimilarity: parseFloat(semanticSimilarity.toFixed(4)),
            keywordMatch: parseFloat(keywordMatch.toFixed(4)),
            metadataQuality: parseFloat(metadataQuality.toFixed(4)),
          },
        },
      };
    });

    // Sort descending by final rerank score
    rescored.sort((a, b) => (b.metadata.rerankScore || 0) - (a.metadata.rerankScore || 0));

    const top5 = rescored.slice(0, topK);
    this.logger.log(
      `Re-ranking complete. Selected Top ${top5.length} chunks. Max score: ${top5[0]?.metadata.rerankScore?.toFixed(4) || 0}`
    );

    return top5;
  }
}
