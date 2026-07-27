import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module';
import { AiModule } from '../ai/ai.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { SearchModule } from '../search/search.module';
import { PromptBuilderService } from './services/prompt-builder.service';
import { RetrievalPipelineService } from './services/retrieval-pipeline.service';
import { RagController } from './rag.controller';

@Module({
  imports: [PdfModule, AiModule, VectorStoreModule, SearchModule],
  controllers: [RagController],
  providers: [PromptBuilderService, RetrievalPipelineService],
  exports: [PromptBuilderService, RetrievalPipelineService],
})
export class RagModule {}
