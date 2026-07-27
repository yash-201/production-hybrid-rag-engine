import { Injectable, Logger } from '@nestjs/common';
import { ChromaService } from '../../vector-store/chroma.service';
import { AiService } from '../../ai/ai.service';
import { SearchResultChunk } from '../interfaces/search-result.interface';

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly chromaService: ChromaService,
    private readonly aiService: AiService
  ) {}

  async search(query: string, topK: number = 10): Promise<SearchResultChunk[]> {
    this.logger.log(`Running Vector Search for query: "${query}" (Top ${topK})...`);

    // 1. Generate query embedding (with automatic caching)
    const embedding = await this.aiService.getEmbedding(query);

    // 2. Query ChromaDB
    const chromaResults = await this.chromaService.query(embedding, topK);

    // 3. Map to standard SearchResultChunk format
    const chunks: SearchResultChunk[] = chromaResults.map((doc) => ({
      id: doc.id,
      text: doc.text,
      metadata: {
        source: doc.metadata.source || 'Uploaded PDF',
        chunkIndex: doc.metadata.chunkIndex ?? 0,
        totalChunks: doc.metadata.totalChunks ?? 1,
        charCount: doc.text.length,
        vectorScore: doc.metadata.similarityScore ?? 0.5,
      },
    }));

    this.logger.log(`Vector Search retrieved ${chunks.length} candidates.`);
    return chunks;
  }
}
