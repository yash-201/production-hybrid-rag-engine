import { Injectable, Logger } from '@nestjs/common';
import { HybridSearchService } from '../../search/services/hybrid-search.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AiService } from '../../ai/ai.service';
import { SearchResultChunk } from '../../search/interfaces/search-result.interface';

export interface RagResponsePayload {
  question: string;
  answer: string;
  confidence: 'High' | 'Medium' | 'Low';
  maxScore: number;
  sources: Array<{
    id: string;
    source: string;
    chunkIndex: number;
    text: string;
    rerankScore?: number;
    vectorScore?: number;
    bm25Score?: number;
  }>;
  pipelineSteps: string[];
}

@Injectable()
export class RetrievalPipelineService {
  private readonly logger = new Logger('RetrievalPipeline');

  constructor(
    private readonly hybridSearchService: HybridSearchService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly aiService: AiService
  ) {}

  /**
   * Executes the 11-Step Production Retrieval & Generation Pipeline with full console logging.
   */
  async processQuery(question: string): Promise<RagResponsePayload> {
    const pipelineLogs: string[] = [];

    const logStep = (stepNumber: number, message: string) => {
      const stepText = `[Step ${stepNumber}/11] ${message}`;
      this.logger.log(stepText);
      pipelineLogs.push(stepText);
    };

    // Step 1: Question Received
    logStep(1, `Question Received: "${question}"`);

    // Step 2: Generating Embedding
    logStep(2, 'Generating Embedding (Checking cache & Gemini API)...');

    // Step 3: Running Vector Search
    logStep(3, 'Running Vector Search (Top 10 from ChromaDB)...');

    // Step 4: Running BM25 Search
    logStep(4, 'Running BM25 Search (Top 10 Keyword Matches)...');

    // Execute Hybrid Search Engine (handles steps 2, 3, 4 internally with merged results)
    const hybridResult = await this.hybridSearchService.executeHybridSearch(question, 10, 10, 5);

    // Step 5: Merging Results
    logStep(5, `Merging Results (${hybridResult.rawCandidatesCount} candidate chunks combined)`);

    // Step 6: Removing Duplicates
    logStep(6, `Removing Duplicates (${hybridResult.deduplicatedCount} unique chunks retained)`);

    // Step 7: Re-ranking
    logStep(7, `Re-ranking candidate chunks using Multi-Factor Scoring...`);

    // Step 8: Selecting Top 5
    logStep(
      8,
      `Selecting Top ${hybridResult.top5Chunks.length} chunks. Max score: ${hybridResult.maxScore} (Confidence: ${hybridResult.confidence})`
    );

    // Step 9: Sending Context to Gemini
    logStep(9, 'Sending Context to Gemini (Building System Prompt & Delimited Context)...');
    const { prompt, systemInstruction } = this.promptBuilderService.buildPrompt(
      question,
      hybridResult.top5Chunks
    );

    // Step 10: Generating Final Response
    logStep(10, 'Generating Final Response with Gemini 2.5 Flash...');
    const answer = await this.aiService.generateResponse(prompt, systemInstruction);

    // Step 11: Completed
    logStep(11, 'Completed RAG Pipeline Execution Successfully.');

    return {
      question,
      answer,
      confidence: hybridResult.confidence,
      maxScore: hybridResult.maxScore,
      sources: hybridResult.top5Chunks.map((chunk) => ({
        id: chunk.id,
        source: chunk.metadata.source,
        chunkIndex: chunk.metadata.chunkIndex,
        text: chunk.text,
        rerankScore: chunk.metadata.rerankScore,
        vectorScore: chunk.metadata.vectorScore,
        bm25Score: chunk.metadata.bm25Score,
      })),
      pipelineSteps: pipelineLogs,
    };
  }
}
