import { SearchResultChunk } from './search-result.interface';

export interface IRerankProvider {
  /**
   * Scores and ranks candidate chunks against the user query.
   * Returns re-scored chunks sorted by highest relevancy score.
   */
  rerank(query: string, chunks: SearchResultChunk[], topK: number): Promise<SearchResultChunk[]>;
}

export const RERANK_PROVIDER = 'IRerankProvider';
