import { Injectable, Logger } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { EmbeddingCacheService } from './services/embedding-cache.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly geminiProvider: GeminiProvider,
    private readonly cacheService: EmbeddingCacheService
  ) {}

  async getEmbedding(text: string): Promise<number[]> {
    const cached = this.cacheService.get(text);
    if (cached) {
      return cached;
    }

    const embedding = await this.geminiProvider.generateEmbedding(text);
    this.cacheService.set(text, embedding);
    return embedding;
  }

  async generateResponse(prompt: string, systemInstruction?: string): Promise<string> {
    return this.geminiProvider.generateText(prompt, systemInstruction);
  }
}
