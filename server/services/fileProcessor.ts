import { aiService } from './ai.js';
import mammoth from 'mammoth';

export interface ProcessedFile {
  summary: string;
  extractedText: string;
}

export class FileProcessor {
  async processFile(buffer: Buffer, filename: string, mimeType: string): Promise<ProcessedFile> {
    let extractedText = '';

    try {
      if (mimeType.startsWith('text/')) {
        extractedText = buffer.toString('utf-8');
      } else if (mimeType === 'application/pdf') {
        console.log(`Processing PDF: ${filename}`);
        try {
          const pdf = await import('pdf-parse');
          const pdfData = await pdf.default(buffer);
          extractedText = pdfData.text;
          console.log(`Extracted ${extractedText.length} characters from PDF`);
        } catch (pdfError) {
          console.error('PDF processing error:', pdfError);
          extractedText = `[Error processing PDF ${filename}: PDF processing not available]`;
        }
      } else if (mimeType.includes('word') || mimeType.includes('document') || 
                 mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 mimeType === 'application/msword') {
        console.log(`Processing Word document: ${filename}`);
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        console.log(`Extracted ${extractedText.length} characters from Word document`);
      } else {
        console.log(`Unsupported file type: ${mimeType} for ${filename}`);
        extractedText = `[File content from ${filename} - unsupported format: ${mimeType}]`;
      }
    } catch (error) {
      console.error(`Error processing file ${filename}:`, error);
      extractedText = `[Error extracting content from ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}]`;
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
