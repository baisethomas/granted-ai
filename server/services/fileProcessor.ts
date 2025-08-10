import { aiService } from './ai.js';

export interface ProcessedFile {
  summary: string;
  extractedText: string;
}

export class FileProcessor {
  async processFile(buffer: Buffer, filename: string, mimeType: string): Promise<ProcessedFile> {
    let extractedText = '';

    // For now, we'll handle text files and provide placeholders for other types
    // In a real implementation, you'd use libraries like pdf-parse, mammoth, etc.
    if (mimeType.startsWith('text/')) {
      extractedText = buffer.toString('utf-8');
    } else if (mimeType === 'application/pdf') {
      // Placeholder for PDF processing
      extractedText = `[PDF content from ${filename} - would be extracted using pdf-parse library]`;
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      // Placeholder for Word document processing
      extractedText = `[Word document content from ${filename} - would be extracted using mammoth library]`;
    } else {
      extractedText = `[File content from ${filename} - unsupported format for text extraction]`;
    }

    // Generate summary using AI
    const summary = await aiService.summarizeDocument(extractedText, filename);

    return {
      summary,
      extractedText: extractedText.substring(0, 10000) // Limit stored text
    };
  }

  async extractQuestionsFromFile(buffer: Buffer, filename: string, mimeType: string): Promise<string[]> {
    const { extractedText } = await this.processFile(buffer, filename, mimeType);
    return await aiService.extractQuestions(extractedText);
  }
}

export const fileProcessor = new FileProcessor();
