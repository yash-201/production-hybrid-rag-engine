import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private genAI: GoogleGenerativeAI;
  private readonly embeddingModelNames = ['gemini-embedding-001', 'gemini-embedding-2'];
  private readonly llmModelNames = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
      this.logger.warn(
        'GEMINI_API_KEY is not configured or using default placeholder. Ensure real key is set in .env'
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'DUMMY_KEY');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    let lastError: Error | null = null;

    for (const modelName of this.embeddingModelNames) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const response = await model.embedContent(text);

        if (response.embedding && response.embedding.values) {
          return response.embedding.values;
        }
      } catch (error) {
        this.logger.warn(`Embedding model ${modelName} failed: ${error.message}. Retrying fallback...`);
        lastError = error;
      }
    }

    this.logger.error(`Failed to generate Gemini embedding across all model candidates: ${lastError?.message}`);
    throw new InternalServerErrorException(`Embedding generation failed: ${lastError?.message}`);
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    let lastError: Error | null = null;

    for (const modelName of this.llmModelNames) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
        });

        const response = await model.generateContent(prompt);
        const text = response.response.text();

        if (text) return text;
      } catch (error) {
        this.logger.warn(`LLM model ${modelName} failed: ${error.message}. Retrying fallback...`);
        lastError = error;
      }
    }

    this.logger.error(`Failed to generate text from Gemini: ${lastError?.message}`);
    throw new InternalServerErrorException(`Gemini text generation failed: ${lastError?.message}`);
  }
}
