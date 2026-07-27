import { Injectable, Inject, Logger } from '@nestjs/common';
import { RERANK_PROVIDER, IRerankProvider } from '../interfaces/rerank-provider.interface';
import { SearchResultChunk } from '../interfaces/search-result.interface';

@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(
    @Inject(RERANK_PROVIDER)
    private readonly rerankProvider: IRerankProvider
  ) {}

  async scoreAndFilter(
    query: string,
    chunks: SearchResultChunk[],
    topK: number = 5
  ): Promise<SearchResultChunk[]> {
    this.logger.log(`RerankService scoring ${chunks.length} chunks via configured provider...`);
    const topChunks = await this.rerankProvider.rerank(query, chunks, topK);
    return topChunks;
  }
}
