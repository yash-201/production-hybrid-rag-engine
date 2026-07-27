import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EmbeddingCacheService {
  private readonly logger = new Logger(EmbeddingCacheService.name);
  private readonly cache = new Map<string, number[]>();
  private readonly maxEntries = 1000;

  private generateHash(text: string): string {
    return crypto.createHash('sha256').update(text.trim()).digest('hex');
  }

  get(text: string): number[] | undefined {
    const hash = this.generateHash(text);
    const hit = this.cache.get(hash);
    if (hit) {
      this.logger.debug(`Cache HIT for embedding key: ${hash.substring(0, 8)}`);
    }
    return hit;
  }

  set(text: string, embedding: number[]): void {
    if (this.cache.size >= this.maxEntries) {
      // LRU Eviction: Remove oldest key
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const hash = this.generateHash(text);
    this.cache.set(hash, embedding);
    this.logger.debug(`Cached embedding key: ${hash.substring(0, 8)}`);
  }

  clear(): void {
    this.cache.clear();
    this.logger.log('Embedding cache cleared.');
  }
}
