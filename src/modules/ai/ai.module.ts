import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { EmbeddingCacheService } from './services/embedding-cache.service';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule],
  providers: [GeminiProvider, EmbeddingCacheService, AiService],
  exports: [AiService, EmbeddingCacheService],
})
export class AiModule {}
