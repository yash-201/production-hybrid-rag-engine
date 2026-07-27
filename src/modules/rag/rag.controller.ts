import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QueryDto } from '../../common/dto/query.dto';
import { PdfService } from '../pdf/pdf.service';
import { AiService } from '../ai/ai.service';
import { ChromaService } from '../vector-store/chroma.service';
import { HybridSearchService } from '../search/services/hybrid-search.service';
import { RetrievalPipelineService, RagResponsePayload } from './services/retrieval-pipeline.service';
import { TextChunkerUtil } from '../../common/utils/text-chunker.util';
import { SearchResultChunk } from '../search/interfaces/search-result.interface';

@Controller('api/rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly aiService: AiService,
    private readonly chromaService: ChromaService,
    private readonly hybridSearchService: HybridSearchService,
    private readonly retrievalPipelineService: RetrievalPipelineService
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No PDF file provided in request.');
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Uploaded file must be a valid PDF document.');
    }

    this.logger.log(`Processing uploaded PDF file: ${file.originalname} (${file.size} bytes)...`);

    // 1. Extract text from PDF
    const text = await this.pdfService.extractTextFromBuffer(file.buffer);
    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Extracted PDF text is empty.');
    }

    // 2. Recursive text chunking
    const rawChunks = TextChunkerUtil.splitText(text, file.originalname, 800, 150);
    this.logger.log(`Generated ${rawChunks.length} recursive text chunks.`);

    // 3. Generate embeddings and prepare documents for ChromaDB & BM25
    const vectorDocs = [];
    const searchResultChunks: SearchResultChunk[] = [];

    for (const chunk of rawChunks) {
      const embedding = await this.aiService.getEmbedding(chunk.text);

      vectorDocs.push({
        id: chunk.id,
        text: chunk.text,
        embedding,
        metadata: chunk.metadata,
      });

      searchResultChunks.push({
        id: chunk.id,
        text: chunk.text,
        metadata: {
          ...chunk.metadata,
          charCount: chunk.text.length,
        },
      });
    }

    // 4. Store vectors in ChromaDB
    await this.chromaService.addDocuments(vectorDocs);

    // 5. Index chunks into BM25 Keyword Search Engine
    this.hybridSearchService.indexDocumentChunks(searchResultChunks);

    return {
      message: 'PDF document successfully processed and indexed into Hybrid Search Engine.',
      fileName: file.originalname,
      totalChunksIndexed: rawChunks.length,
    };
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryRag(@Body() queryDto: QueryDto): Promise<RagResponsePayload> {
    return this.retrievalPipelineService.processQuery(queryDto.question);
  }

  @Get('collection')
  async getCollectionInfo() {
    return this.chromaService.getAllDocuments();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetCollection() {
    await this.chromaService.resetCollection();
    return { message: 'Knowledge base collection reset successfully.' };
  }
}
