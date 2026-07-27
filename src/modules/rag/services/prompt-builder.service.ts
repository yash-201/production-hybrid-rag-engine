import { Injectable, Logger } from '@nestjs/common';
import { SearchResultChunk } from '../../search/interfaces/search-result.interface';
import { SanitizerUtil } from '../../../common/utils/sanitizer.util';

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  /**
   * System Prompt enforcing polite conversational handling alongside anti-hallucination guardrails.
   */
  getSystemInstruction(): string {
    return `You are a polite, professional, and accurate AI Knowledge Base Assistant.

RESPONSE GUIDELINES:
1. GREETINGS & CONVERSATIONAL PLEASANTRIES: If the user's input is a general greeting or polite pleasantry (such as "hello", "hi", "how are you?", "good morning", "who are you?"), respond warmly, politely, and introduce yourself briefly as the AI Knowledge Assistant ready to help with their uploaded documents.

2. DOCUMENT & FACTUAL QUERIES: Answer factual questions accurately using ONLY the verified context provided inside the <context> tags.
- NEVER hallucinate, invent, assume, or extrapolate facts beyond what is explicitly stated in the context.
- If the question asks for specific domain information that is NOT mentioned or verified by the context, respond politely: "I couldn't find this information in the uploaded knowledge base."

3. TONE: Helpful, polite, professional, and clear.`;
  }

  /**
   * Constructs the final LLM prompt combining System Instructions, Context, and User Query.
   */
  buildPrompt(query: string, retrievedChunks: SearchResultChunk[]): { prompt: string; systemInstruction: string } {
    this.logger.log(`Building prompt for query: "${query}" with ${retrievedChunks?.length || 0} context chunks...`);

    const sanitizedQuery = SanitizerUtil.sanitizeText(query);

    if (!retrievedChunks || retrievedChunks.length === 0) {
      const emptyPrompt = `User Input:
${sanitizedQuery}

Retrieved Knowledge Base Context:
No document context found.

Instructions:
1. If the user input is a greeting or polite phrase (e.g. "hello", "hi", "how are you?", "good morning"), respond warmly and politely as an AI assistant.
2. Otherwise, if the user is asking a specific document question, respond: "I couldn't find this information in the uploaded knowledge base."`;
      return { prompt: emptyPrompt, systemInstruction: this.getSystemInstruction() };
    }

    // Format retrieved chunks with clear source attribution
    const formattedChunks = retrievedChunks
      .map(
        (chunk, idx) =>
          `[Source ${idx + 1} | File: ${chunk.metadata.source} | Chunk: ${chunk.metadata.chunkIndex}]\n${chunk.text}`
      )
      .join('\n\n---\n\n');

    const safeContext = SanitizerUtil.wrapContextSafely(formattedChunks);

    const fullPrompt = `User Input:
${sanitizedQuery}

Retrieved Knowledge Base Context:
${safeContext}

Instructions:
1. If the user input is a greeting or polite phrase (e.g. "hello", "hi", "how are you?", "good morning"), respond warmly and politely as the AI Assistant.
2. Otherwise, synthesize a concise, accurate answer to the user question using ONLY the knowledge base context provided above. If the context does not contain the answer, state: "I couldn't find this information in the uploaded knowledge base."`;

    return {
      prompt: fullPrompt,
      systemInstruction: this.getSystemInstruction(),
    };
  }
}
