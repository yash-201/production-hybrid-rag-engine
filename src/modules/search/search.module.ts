import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { AiModule } from '../ai/ai.module';
import { BM25Service } from './services/bm25.service';
import { VectorSearchService } from './services/vector-search.service';
import { RerankService } from './services/rerank.service';
import { HybridSearchService } from './services/hybrid-search.service';
import { CustomRerankProvider } from './providers/custom-rerank.provider';
import { CohereRerankProvider } from './providers/cohere-rerank.provider';
import { RERANK_PROVIDER } from './interfaces/rerank-provider.interface';

@Module({
  imports: [ConfigModule, VectorStoreModule, AiModule],
  providers: [
    BM25Service,
    VectorSearchService,
    CustomRerankProvider,
    CohereRerankProvider,
    {
      provide: RERANK_PROVIDER,
      useFactory: (configService: ConfigService, custom: CustomRerankProvider, cohere: CohereRerankProvider) => {
        const useCohere = configService.get<string>('USE_COHERE_RERANK') === 'true';
        return useCohere ? cohere : custom;
      },
      inject: [ConfigService, CustomRerankProvider, CohereRerankProvider],
    },
    RerankService,
    HybridSearchService,
  ],
  exports: [
    BM25Service,
    VectorSearchService,
    RerankService,
    HybridSearchService,
  ],
})
export class SearchModule {}
