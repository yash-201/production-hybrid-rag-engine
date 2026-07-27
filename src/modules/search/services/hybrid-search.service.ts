import { Injectable, Logger } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';
import { BM25Service } from './bm25.service';
import { RerankService } from './rerank.service';
import { SearchResultChunk, HybridSearchResult } from '../interfaces/search-result.interface';

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private readonly vectorSearchService: VectorSearchService,
    private readonly bm25Service: BM25Service,
    private readonly rerankService: RerankService
  ) {}

  /**
   * Indexes newly uploaded document chunks into the BM25 search index.
   */
  indexDocumentChunks(chunks: SearchResultChunk[]): void {
    this.bm25Service.indexDocuments(chunks);
  }

  /**
   * Executes the full Hybrid Search workflow:
   * 1. Vector Search (Top 10)
   * 2. BM25 Search (Top 10)
   * 3. Merge Results
   * 4. Remove Duplicate Chunks
   * 5. Re-ranking Layer (Top 5)
   */
  async executeHybridSearch(
    query: string,
    vectorTopK: number = 10,
    bm25TopK: number = 10,
    finalTopK: number = 5
  ): Promise<HybridSearchResult> {
    this.logger.log(`Starting Hybrid Search for query: "${query}"...`);

    // Step 1: Semantic Vector Search (Top 10)
    const vectorChunks = await this.vectorSearchService.search(query, vectorTopK);

    // Step 2: BM25 Keyword Search (Top 10)
    const bm25Chunks = this.bm25Service.search(query, bm25TopK);

    // Step 3: Merge Results
    const combinedCandidates = [...vectorChunks, ...bm25Chunks];
    const rawCount = combinedCandidates.length;
    this.logger.log(`Merged Results: ${rawCount} raw candidates combined.`);

    // Step 4: Remove Duplicate Chunks by chunk ID / Content Hash
    const uniqueMap = new Map<string, SearchResultChunk>();

    for (const chunk of combinedCandidates) {
      if (!uniqueMap.has(chunk.id)) {
        uniqueMap.set(chunk.id, { ...chunk });
      } else {
        // If chunk exists in both Vector and BM25 results, combine scores!
        const existing = uniqueMap.get(chunk.id)!;
        existing.metadata = {
          ...existing.metadata,
          vectorScore: chunk.metadata.vectorScore ?? existing.metadata.vectorScore,
          bm25Score: chunk.metadata.bm25Score ?? existing.metadata.bm25Score,
        };
      }
    }

    const deduplicatedChunks = Array.from(uniqueMap.values());
    this.logger.log(`Deduplication complete: ${deduplicatedChunks.length} unique candidate chunks retained.`);

    // Step 5: Re-ranking Layer (Selecting Top 5)
    const top5Chunks = await this.rerankService.scoreAndFilter(query, deduplicatedChunks, finalTopK);

    // Compute highest score & confidence indicator
    const maxScore = top5Chunks.length > 0 ? (top5Chunks[0].metadata.rerankScore || 0) : 0;
    let confidence: 'High' | 'Medium' | 'Low' = 'Low';

    if (maxScore >= 0.65) {
      confidence = 'High';
    } else if (maxScore >= 0.45) {
      confidence = 'Medium';
    }

    return {
      rawCandidatesCount: rawCount,
      deduplicatedCount: deduplicatedChunks.length,
      top5Chunks,
      maxScore: parseFloat(maxScore.toFixed(4)),
      confidence,
    };
  }
}
