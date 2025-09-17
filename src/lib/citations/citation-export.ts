/**
 * Citation Export System
 * 
 * Enhances existing export functions to preserve citation formatting
 * and provide proper academic/grant writing citation styles.
 */

import jsPDF from "jspdf";
import { Document, Paragraph, TextRun, Footer, PageNumber } from "docx";
import { 
  CitationSource, 
  ParagraphCitation, 
  FormattedCitation,
  CitationExportOptions,
  CitationFormat 
} from "./types";
import { CitationParser } from "./citation-parser";

export class CitationExportService {
  private parser: CitationParser;

  constructor() {
    this.parser = new CitationParser();
  }

  /**
   * Export draft to PDF with proper citations
   */
  async exportToPdfWithCitations(
    content: string,
    citations: ParagraphCitation[],
    options: CitationExportOptions,
    filename: string
  ): Promise<void> {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    // Format citations
    const allCitations = citations.flatMap(p => p.sources);
    const formattedCitations = this.parser.formatCitationsForExport(allCitations, options);

    // Process content with citations
    const processedContent = this.insertCitationsIntoContent(
      content, 
      citations, 
      formattedCitations, 
      options
    );

    // Add content to PDF
    let yPosition = margin;
    const lineHeight = 7;
    const fontSize = 11;

    pdf.setFontSize(fontSize);

    // Split content into pages
    const paragraphs = processedContent.split('\n\n');
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      const lines = pdf.splitTextToSize(paragraph, maxWidth);
      
      // Check if we need a new page
      if (yPosition + (lines.length * lineHeight) > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      // Add paragraph
      for (const line of lines) {
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      }
      
      yPosition += lineHeight * 0.5; // Paragraph spacing
    }

    // Add bibliography if requested
    if (options.format === 'bibliography' || options.format === 'footnote') {
      yPosition = this.addBibliographyToPdf(pdf, formattedCitations, yPosition, margin, maxWidth, lineHeight);
    }

    // Add footer with page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    pdf.save(filename);
  }

  /**
   * Export draft to DOCX with proper citations
   */
  async exportToDocxWithCitations(
    content: string,
    citations: ParagraphCitation[],
    options: CitationExportOptions,
    filename: string
  ): Promise<Uint8Array> {
    const allCitations = citations.flatMap(p => p.sources);
    const formattedCitations = this.parser.formatCitationsForExport(allCitations, options);

    const processedContent = this.insertCitationsIntoContent(
      content, 
      citations, 
      formattedCitations, 
      options
    );

    const paragraphs = processedContent.split('\n\n').map(paragraphText => {
      if (!paragraphText.trim()) {
        return new Paragraph({ text: "" });
      }

      // Parse inline citations and footnotes
      const runs = this.createTextRunsWithCitations(paragraphText, options);
      
      return new Paragraph({
        children: runs,
        spacing: { after: 240 }
      });
    });

    // Add bibliography if requested
    if (options.format === 'bibliography') {
      paragraphs.push(new Paragraph({ text: "" })); // Spacer
      paragraphs.push(new Paragraph({ 
        text: "References",
        heading: "Heading2",
        spacing: { before: 480, after: 240 }
      }));

      formattedCitations.forEach(citation => {
        paragraphs.push(new Paragraph({
          text: citation.bibliographyEntry,
          spacing: { after: 120 }
        }));
      });
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            }
          }
        },
        children: paragraphs,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: "center",
                children: [
                  new TextRun({
                    children: ["Page ", PageNumber.CURRENT],
                  }),
                ],
              }),
            ],
          }),
        }
      }]
    });

    return await doc.toUint8Array();
  }

  /**
   * Create copy-paste text with preserved citations
   */
  createCitedTextForCopy(
    content: string,
    citations: ParagraphCitation[],
    options: CitationExportOptions
  ): string {
    const allCitations = citations.flatMap(p => p.sources);
    const formattedCitations = this.parser.formatCitationsForExport(allCitations, options);

    let result = this.insertCitationsIntoContent(
      content, 
      citations, 
      formattedCitations, 
      options
    );

    // Add bibliography section
    if (options.format === 'bibliography') {
      result += '\n\n' + '='.repeat(50) + '\n';
      result += 'REFERENCES\n';
      result += '='.repeat(50) + '\n\n';
      
      formattedCitations.forEach(citation => {
        result += citation.bibliographyEntry + '\n\n';
      });
    }

    return result;
  }

  /**
   * Generate citation statistics report
   */
  generateCitationReport(
    citations: ParagraphCitation[],
    totalParagraphs: number
  ): string {
    const allSources = citations.flatMap(p => p.sources);
    const uniqueDocuments = new Set(allSources.map(s => s.documentId)).size;
    const averageGrounding = citations.length > 0 
      ? citations.reduce((sum, c) => sum + c.groundingQuality, 0) / citations.length 
      : 0;
    const citationCoverage = (citations.length / totalParagraphs) * 100;

    const strongCitations = allSources.filter(s => s.citationStrength === 'strong').length;
    const moderateCitations = allSources.filter(s => s.citationStrength === 'moderate').length;
    const weakCitations = allSources.filter(s => s.citationStrength === 'weak').length;

    return `
CITATION QUALITY REPORT
========================

Overall Statistics:
- Total Paragraphs: ${totalParagraphs}
- Paragraphs with Citations: ${citations.length}
- Citation Coverage: ${citationCoverage.toFixed(1)}%
- Average Grounding Quality: ${(averageGrounding * 100).toFixed(1)}%

Source Analysis:
- Total Citations: ${allSources.length}
- Unique Source Documents: ${uniqueDocuments}
- Strong Citations: ${strongCitations} (${(strongCitations/allSources.length*100).toFixed(1)}%)
- Moderate Citations: ${moderateCitations} (${(moderateCitations/allSources.length*100).toFixed(1)}%)
- Weak Citations: ${weakCitations} (${(weakCitations/allSources.length*100).toFixed(1)}%)

Quality Assessment:
${averageGrounding >= 0.8 ? '✓ Excellent grounding quality' :
  averageGrounding >= 0.6 ? '△ Good grounding quality with room for improvement' :
  '✗ Grounding quality needs significant improvement'}

${citationCoverage >= 80 ? '✓ Good citation coverage' :
  citationCoverage >= 60 ? '△ Moderate citation coverage' :
  '✗ Low citation coverage - more evidence needed'}
`;
  }

  // Private helper methods

  private insertCitationsIntoContent(
    content: string,
    citations: ParagraphCitation[],
    formattedCitations: FormattedCitation[],
    options: CitationExportOptions
  ): string {
    let result = content;
    
    // For each paragraph with citations, insert formatted citations
    citations.forEach((paragraphCitation, paragraphIndex) => {
      const paragraphText = paragraphCitation.paragraphText;
      
      // Find the paragraph in the content
      const paragraphStart = result.indexOf(paragraphText);
      if (paragraphStart === -1) return;

      let modifiedParagraph = paragraphText;
      let citationIndex = 0;

      // Insert citations based on source positions
      paragraphCitation.sources
        .sort((a, b) => b.positionInParagraph - a.positionInParagraph) // Reverse order for insertion
        .forEach(source => {
          const relevantCitation = formattedCitations.find(fc => 
            fc.bibliographyEntry.includes(source.sectionTitle || '')
          );
          
          if (relevantCitation) {
            const insertPosition = Math.min(source.positionInParagraph, modifiedParagraph.length);
            
            modifiedParagraph = 
              modifiedParagraph.slice(0, insertPosition) +
              ' ' + relevantCitation.inlineText +
              modifiedParagraph.slice(insertPosition);
          }
        });

      // Replace the original paragraph with the cited version
      result = result.replace(paragraphText, modifiedParagraph);
    });

    return result;
  }

  private createTextRunsWithCitations(text: string, options: CitationExportOptions): TextRun[] {
    const runs: TextRun[] = [];
    
    // Simple implementation - in production, would parse citations more sophisticatedly
    const parts = text.split(/(\([^)]+\)|\[[^\]]+\])/);
    
    parts.forEach(part => {
      if (part.match(/^\([^)]+\)$/) || part.match(/^\[[^\]]+\]$/)) {
        // This is a citation
        runs.push(new TextRun({
          text: part,
          font: "Times New Roman",
          size: 22,
          color: "0066CC" // Blue color for citations
        }));
      } else {
        // Regular text
        runs.push(new TextRun({
          text: part,
          font: "Times New Roman",
          size: 22
        }));
      }
    });

    return runs;
  }

  private addBibliographyToPdf(
    pdf: jsPDF,
    citations: FormattedCitation[],
    startY: number,
    margin: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    let yPosition = startY + lineHeight * 2;

    // Add bibliography header
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('References', margin, yPosition);
    yPosition += lineHeight * 1.5;

    // Reset font for bibliography entries
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');

    citations.forEach(citation => {
      const lines = pdf.splitTextToSize(citation.bibliographyEntry, maxWidth);
      
      // Check if we need a new page
      if (yPosition + (lines.length * lineHeight) > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      // Add bibliography entry
      for (const line of lines) {
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      }
      
      yPosition += lineHeight * 0.3; // Entry spacing
    });

    return yPosition;
  }
}

// Enhanced export functions that integrate with existing exports
export async function exportElementToPdfWithCitations(
  element: HTMLElement, 
  citations: ParagraphCitation[],
  options: CitationExportOptions,
  filename: string
) {
  const exportService = new CitationExportService();
  const textContent = element.textContent || element.innerText || '';
  
  await exportService.exportToPdfWithCitations(
    textContent,
    citations,
    options,
    filename
  );
}

export async function exportToDocxWithCitations(
  content: string,
  citations: ParagraphCitation[],
  options: CitationExportOptions
): Promise<Uint8Array> {
  const exportService = new CitationExportService();
  return await exportService.exportToDocxWithCitations(content, citations, options, 'draft.docx');
}

export function exportToCopyWithCitations(
  content: string,
  citations: ParagraphCitation[],
  options: CitationExportOptions
): string {
  const exportService = new CitationExportService();
  return exportService.createCitedTextForCopy(content, citations, options);
}