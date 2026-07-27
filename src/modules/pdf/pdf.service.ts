import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('Uploaded PDF buffer is empty.');
      }

      const data = await pdfParse(buffer);
      this.logger.log(`PDF successfully parsed. Extracted ${data.numpages} pages.`);
      return data.text || '';
    } catch (error) {
      this.logger.error(`Error parsing PDF document: ${error.message}`);
      throw new BadRequestException(`Failed to parse PDF document: ${error.message}`);
    }
  }
}
