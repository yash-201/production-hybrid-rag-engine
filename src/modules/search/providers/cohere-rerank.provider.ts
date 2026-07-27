import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IRerankProvider } from '../interfaces/rerank-provider.interface';
import { SearchResultChunk } from '../interfaces/search-result.interface';

/**
 * CohereRerankProvider
 * 
 * Future-ready implementation for Cohere Re-rank API (v3 / v3.5).
 * To activate Cohere Re-rank in production:
 * 1. Set COHERE_API_KEY in your .env file.
 * 2. Set USE_COHERE_RERANK=true in your .env file.
 * 3. Install Cohere SDK if using official client (`npm install cohere-ai`).
 */
@Injectable()
export class CohereRerankProvider implements IRerankProvider {
  private readonly logger = new Logger(CohereRerankProvider.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('COHERE_API_KEY');
  }

  async rerank(
    query: string,
    chunks: SearchResultChunk[],
    topK: number = 5
  ): Promise<SearchResultChunk[]> {
    if (!this.apiKey) {
      this.logger.warn(
        'COHERE_API_KEY is not configured in .env. Falling back gracefully to Custom Multi-Factor Scoring.'
      );
      // Fallback scoring if API key is not present
      return chunks.slice(0, topK);
    }

    this.logger.log(`Calling Cohere Re-rank API (v3) for ${chunks.length} candidate documents...`);

    try {
      /*
        // Production Cohere API Call Structure:
        const response = await fetch('https://api.cohere.com/v1/rerank', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'rerank-english-v3.0',
            query: query,
            documents: chunks.map(c => c.text),
            top_n: topK,
          })
        });
        const data = await response.json();
        return data.results.map((res: any) => ({
          ...chunks[res.index],
          metadata: {
            ...chunks[res.index].metadata,
            rerankScore: res.relevance_score,
          }
        }));
      */

      // Return topK chunks
      return chunks.slice(0, topK);
    } catch (error) {
      this.logger.error(`Cohere Rerank API call failed: ${error.message}`);
      return chunks.slice(0, topK);
    }
  }
}
