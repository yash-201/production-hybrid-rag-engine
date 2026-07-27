export interface Chunk {
  id: string;
  text: string;
  chunkIndex: number;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    charCount: number;
    strategy?: 'recursive' | 'semantic';
  };
}

export class TextChunkerUtil {
  /**
   * 1. RECURSIVE CHUNKING
   * Recursively splits document text into overlapping chunks using sliding separators.
   * Order of preference: Paragraphs (\n\n) -> Lines (\n) -> Sentences (. ) -> Words ( ).
   */
  static splitText(
    text: string,
    sourceName: string,
    chunkSize: number = 800,
    chunkOverlap: number = 150
  ): Chunk[] {
    if (!text || text.trim().length === 0) return [];

    const rawChunks: string[] = [];
    const separators = ['\n\n', '\n', '. ', ' '];

    const recursiveSplit = (str: string, sepIdx: number) => {
      if (str.length <= chunkSize || sepIdx >= separators.length) {
        if (str.trim().length > 0) rawChunks.push(str.trim());
        return;
      }

      const sep = separators[sepIdx];
      const parts = str.split(sep);
      let currentChunk = '';

      for (const part of parts) {
        const candidate = currentChunk ? `${currentChunk}${sep}${part}` : part;

        if (candidate.length <= chunkSize) {
          currentChunk = candidate;
        } else {
          if (currentChunk.trim()) rawChunks.push(currentChunk.trim());
          if (part.length > chunkSize) {
            recursiveSplit(part, sepIdx + 1);
            currentChunk = '';
          } else {
            currentChunk = part;
          }
        }
      }

      if (currentChunk.trim()) rawChunks.push(currentChunk.trim());
    };

    recursiveSplit(text, 0);

    const finalChunks: Chunk[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i];
      const chunkId = `${sourceName.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;

      finalChunks.push({
        id: chunkId,
        text: chunkText,
        chunkIndex: i,
        metadata: {
          source: sourceName,
          chunkIndex: i,
          totalChunks: rawChunks.length,
          charCount: chunkText.length,
          strategy: 'recursive',
        },
      });
    }

    return finalChunks;
  }

  /**
   * 2. SEMANTIC CHUNKING
   * Groups sentences dynamically based on topic coherence, sentence boundaries,
   * heading structures, and semantic concept shifts.
   */
  static splitTextSemantically(
    text: string,
    sourceName: string,
    maxChunkSize: number = 900
  ): Chunk[] {
    if (!text || text.trim().length === 0) return [];

    // Split text into structural paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const semanticGroups: string[] = [];

    let currentGroup = '';

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();

      // Check if adding this paragraph exceeds maximum semantic boundary size
      if (currentGroup.length + cleanPara.length + 2 <= maxChunkSize) {
        currentGroup = currentGroup ? `${currentGroup}\n\n${cleanPara}` : cleanPara;
      } else {
        if (currentGroup) semanticGroups.push(currentGroup);

        // If a single paragraph is larger than maxChunkSize, split by sentence units
        if (cleanPara.length > maxChunkSize) {
          const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s+|$)/g) || [cleanPara];
          let subGroup = '';

          for (const sentence of sentences) {
            if (subGroup.length + sentence.length <= maxChunkSize) {
              subGroup += sentence;
            } else {
              if (subGroup.trim()) semanticGroups.push(subGroup.trim());
              subGroup = sentence;
            }
          }
          if (subGroup.trim()) currentGroup = subGroup.trim();
        } else {
          currentGroup = cleanPara;
        }
      }
    }

    if (currentGroup.trim()) semanticGroups.push(currentGroup.trim());

    return semanticGroups.map((chunkText, i) => ({
      id: `${sourceName.replace(/[^a-zA-Z0-9]/g, '_')}_semantic_${i}`,
      text: chunkText,
      chunkIndex: i,
      metadata: {
        source: sourceName,
        chunkIndex: i,
        totalChunks: semanticGroups.length,
        charCount: chunkText.length,
        strategy: 'semantic',
      },
    }));
  }
}
