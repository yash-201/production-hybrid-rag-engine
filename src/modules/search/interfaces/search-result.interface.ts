export interface SearchResultChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    charCount: number;
    vectorScore?: number;
    bm25Score?: number;
    rerankScore?: number;
    rankFactors?: {
      semanticSimilarity: number;
      keywordMatch: number;
      metadataQuality: number;
    };
  };
}

export interface HybridSearchResult {
  rawCandidatesCount: number;
  deduplicatedCount: number;
  top5Chunks: SearchResultChunk[];
  maxScore: number;
  confidence: 'High' | 'Medium' | 'Low';
}
