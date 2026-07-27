import { Injectable, Logger, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client: ChromaClient;
  private collection: Collection | null = null;
  private readonly collectionName: string;
  private readonly chromaUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.chromaUrl = this.configService.get<string>('CHROMA_URL', 'http://127.0.0.1:8008');
    this.collectionName = this.configService.get<string>('CHROMA_COLLECTION', 'hybrid_rag_collection');
    this.client = new ChromaClient({ path: this.chromaUrl });
  }

  async onModuleInit() {
    try {
      await this.getCollection();
    } catch (err) {
      this.logger.warn(`Initial ChromaDB connection on startup pending: ${err.message}`);
    }
  }

  private async getCollection(): Promise<Collection> {
    if (this.collection) return this.collection;

    try {
      this.logger.log(`Initializing ChromaDB collection "${this.collectionName}" at ${this.chromaUrl}...`);
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
      });
      this.logger.log(`ChromaDB collection "${this.collectionName}" initialized successfully.`);
      return this.collection;
    } catch (error) {
      this.collection = null;
      this.logger.error(`Failed to connect to ChromaDB at ${this.chromaUrl}: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to connect to ChromaDB server at ${this.chromaUrl}: ${error.message}`
      );
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const collection = await this.getCollection();

    if (!documents || documents.length === 0) return;

    const ids = documents.map((doc) => doc.id);
    const embeddings = documents.map((doc) => doc.embedding);
    const metadatas = documents.map((doc) => doc.metadata);
    const documentsText = documents.map((doc) => doc.text);

    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents: documentsText,
    });

    this.logger.log(`Added ${documents.length} vectors to ChromaDB.`);
  }

  async query(queryEmbedding: number[], topK: number = 10): Promise<VectorDocument[]> {
    let collection: Collection;
    try {
      collection = await this.getCollection();
    } catch (error) {
      this.logger.warn(`ChromaDB collection unavailable for query: ${error.message}`);
      return [];
    }

    try {
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
      });

      const documents: VectorDocument[] = [];
      if (results && results.ids && results.ids[0]) {
        const ids = results.ids[0];
        const docs = results.documents[0];
        const metadatas = results.metadatas[0];
        const distances = results.distances ? results.distances[0] : [];

        for (let i = 0; i < ids.length; i++) {
          const distance = distances[i] ?? 0.5;
          const cosineSimilarity = Math.max(0, 1 - distance);

          documents.push({
            id: ids[i],
            text: docs[i] || '',
            embedding: [],
            metadata: {
              ...(metadatas[i] || {}),
              similarityScore: cosineSimilarity,
            },
          });
        }
      }

      return documents;
    } catch (queryError) {
      this.logger.warn(
        `ChromaDB vector query failed: ${queryError.message}. Resetting collection connection cache and falling back to BM25 search.`
      );
      this.collection = null;
      return [];
    }
  }

  async getAllDocuments(): Promise<any> {
    try {
      const collection = await this.getCollection();
      const count = await collection.count();
      const getResults = await collection.get({
        limit: 200,
        include: ['documents', 'metadatas'] as any,
      });

      return {
        collectionName: this.collectionName,
        totalCount: count,
        documents: (getResults.ids || []).map((id, index) => ({
          id,
          text: getResults.documents ? getResults.documents[index] : '',
          metadata: getResults.metadatas ? getResults.metadatas[index] : {},
        })),
      };
    } catch (error) {
      return {
        collectionName: this.collectionName,
        totalCount: 0,
        documents: [],
        error: error.message,
      };
    }
  }

  async resetCollection(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = null;
      await this.getCollection();
      this.logger.log('Collection reset successfully.');
    } catch (error) {
      this.logger.error(`Error resetting Chroma collection: ${error.message}`);
      this.collection = null;
    }
  }
}
