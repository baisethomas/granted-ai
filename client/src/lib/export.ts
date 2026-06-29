import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { Project, GrantQuestion } from './api';

export interface ExportData {
  project: Project;
  questions: GrantQuestion[];
  metadata: {
    exportDate: Date;
    organizationName?: string;
  };
}

// Remove trailing meta blocks ("Citations:", "Assumptions & Follow-ups:", etc.)
// that some legacy drafts persisted inside the response body.
function stripMetaBlocks(text: string): string {
  if (!text) return text;
  return text.replace(
    /\n{1,}\s*(?:Citations|Assumptions(?:\s*&\s*Follow-?ups)?|Follow-?ups)\s*:\s*[\s\S]*$/i,
    '',
  );
}

// Strip markdown formatting so exports are clean prose, not AI-style markdown.
export function stripMarkdown(text: string): string {
  if (!text) return text;

  return stripMetaBlocks(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Return a copy of the response text that is safe for export: meta blocks
// removed and any markdown artifacts stripped.
function getCleanResponse(question: GrantQuestion): string {
  return stripMarkdown(question.response || '');
}

// Unresolved "Needs your input" gaps for a question. These must stay visible
// in exported documents — a gap the AI flagged is never silently dropped.
function getUnresolvedGaps(question: GrantQuestion): string[] {
  return (question.assumptions || [])
    .filter((assumption) => !assumption.resolved)
    .map((assumption) => (assumption.suggestedQuestion || assumption.text || '').trim())
    .filter(Boolean);
}

/**
 * Build clipboard text with professional grant-application structure.
 */
export function buildClipboardText(data: ExportData): string {
  const { project, questions, metadata } = data;

  const completedQuestions = questions.filter(
    (q) => q.responseStatus === "complete" || q.responseStatus === "edited"
  );

  const header = metadata.organizationName
    ? `${metadata.organizationName} - Grant Application\n\n`
    : "Grant Application\n\n";

  const projectInfo = [
    `Project Title: ${project.title}`,
    `Funder: ${project.funder}`,
    project.amount ? `Amount Requested: ${project.amount}` : null,
    project.deadline
      ? `Application Deadline: ${new Date(project.deadline).toLocaleDateString()}`
      : null,
    "",
    project.description ? `Project Description:\n${project.description}\n` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const responses = completedQuestions
    .map((q, index) => {
      const cleanResponse = getCleanResponse(q);
      const wordCount = cleanResponse ? cleanResponse.trim().split(/\s+/).length : 0;
      const wordLimitText = q.wordLimit
        ? ` (${wordCount}/${q.wordLimit} words)`
        : ` (${wordCount} words)`;

      const gaps = getUnresolvedGaps(q);

      return [
        `${index + 1}. ${q.question}${wordLimitText}`,
        "",
        cleanResponse || "No response provided",
        ...(gaps.length ? ["", ...gaps.map((gap) => `[NEEDS YOUR INPUT: ${gap}]`)] : []),
        "",
        "---",
        "",
      ].join("\n");
    })
    .join("\n");

  const footer = `\nGenerated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}`;

  return [header, projectInfo, "Grant Application Responses:", "", responses, footer].join("\n");
}

/**
 * Enhanced clipboard export with professional formatting
 */
export async function exportToClipboard(data: ExportData): Promise<void> {
  const fullText = buildClipboardText(data);

  try {
    await navigator.clipboard.writeText(fullText);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = fullText;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

/**
 * Build a PDF document with professional grant-application formatting.
 */
export function createPdfDocument(data: ExportData): jsPDF {
  const { project, questions, metadata } = data;

  const completedQuestions = questions.filter(
    (q) => q.responseStatus === "complete" || q.responseStatus === "edited"
  );

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.4;
    
    for (const line of lines) {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    }
  };

  // Helper to add spacing
  const addSpace = (mm: number) => {
    yPosition += mm;
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Title
  const title = metadata.organizationName 
    ? `${metadata.organizationName} - Grant Application`
    : 'Grant Application';
  addWrappedText(title, 18, true, [30, 64, 175]);
  addSpace(5);

  // Horizontal line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  addSpace(10);

  // Project Information Section
  addWrappedText('Project Information', 14, true, [30, 64, 175]);
  addSpace(5);

  addWrappedText(`Project Title: ${project.title}`, 11, false);
  addSpace(2);
  addWrappedText(`Funder: ${project.funder}`, 11, false);
  addSpace(2);
  
  if (project.amount) {
    addWrappedText(`Amount Requested: ${project.amount}`, 11, false);
    addSpace(2);
  }
  
  if (project.deadline) {
    addWrappedText(`Application Deadline: ${new Date(project.deadline).toLocaleDateString()}`, 11, false);
    addSpace(2);
  }

  if (project.description) {
    addSpace(3);
    addWrappedText('Project Description:', 11, true);
    addSpace(2);
    addWrappedText(project.description, 10, false);
  }

  addSpace(10);

  // Responses Section
  addWrappedText('Grant Application Responses', 14, true, [30, 64, 175]);
  addSpace(3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  addSpace(8);

  // Each question and response
  completedQuestions.forEach((question, index) => {
    const cleanResponse = getCleanResponse(question);
    const wordCount = cleanResponse ? cleanResponse.trim().split(/\s+/).length : 0;
    const wordLimitText = question.wordLimit
      ? ` (${wordCount}/${question.wordLimit} words)`
      : ` (${wordCount} words)`;

    // Question header
    addWrappedText(`${index + 1}. ${question.question}${wordLimitText}`, 11, true, [55, 65, 81]);
    addSpace(4);

    // Response content
    const responseText = cleanResponse || 'No response provided';
    addWrappedText(responseText, 10, false);

    // Unresolved gaps stay visible in the exported document
    const gaps = getUnresolvedGaps(question);
    if (gaps.length > 0) {
      addSpace(3);
      gaps.forEach((gap) => {
        addWrappedText(`[NEEDS YOUR INPUT: ${gap}]`, 10, true, [180, 83, 9]);
        addSpace(2);
      });
    }

    addSpace(8);
  });

  // Footer
  addSpace(10);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  addSpace(5);
  
  const footerText = `Generated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}`;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(footerText, pageWidth / 2, yPosition, { align: 'center' });

  return doc;
}

/**
 * Export to PDF with professional formatting
 */
export async function exportToPDF(data: ExportData): Promise<void> {
  const doc = createPdfDocument(data);
  const filename = `${sanitizeFilename(data.project.title)}-Grant-Application.pdf`;

  try {
    doc.save(filename);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw new Error("Failed to generate PDF document. Please try again.");
  }
}

/**
 * Build a Word document with professional grant-application formatting.
 */
export function createWordDocument(data: ExportData): Document {
  const { project, questions, metadata } = data;

  const completedQuestions = questions.filter(
    (q) => q.responseStatus === "complete" || q.responseStatus === "edited"
  );

  const children = [];

  // Header
  if (metadata.organizationName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${metadata.organizationName} - Grant Application`,
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Grant Application",
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );
  }

  // Project Information
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Project Information", bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  const projectInfo = [
    [`Project Title:`, project.title],
    [`Funder:`, project.funder],
    ...(project.amount ? [["Amount Requested:", project.amount]] : []),
    ...(project.deadline
      ? [["Application Deadline:", new Date(project.deadline).toLocaleDateString()]]
      : []),
  ];

  projectInfo.forEach(([label, value]) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: label, bold: true }), new TextRun({ text: ` ${value}` })],
        spacing: { after: 100 },
      })
    );
  });

  // Project Description
  if (project.description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Project Description:", bold: true })],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: project.description })],
        spacing: { after: 400 },
      })
    );
  }

  // Grant Application Responses
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Grant Application Responses", bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  // Questions and Responses
  completedQuestions.forEach((question, index) => {
    const cleanResponse = getCleanResponse(question);
    const wordCount = cleanResponse ? cleanResponse.trim().split(/\s+/).length : 0;
    const wordLimitText = question.wordLimit
      ? ` (${wordCount}/${question.wordLimit} words)`
      : ` (${wordCount} words)`;

    const paragraphs = (cleanResponse || "No response provided")
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const gaps = getUnresolvedGaps(question);

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${question.question}${wordLimitText}`,
            bold: true,
            size: 22,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
      ...paragraphs.map(
        (paragraph, pIndex) =>
          new Paragraph({
            children: [new TextRun({ text: paragraph })],
            spacing: { after: pIndex === paragraphs.length - 1 && gaps.length === 0 ? 300 : 150 },
          })
      ),
      ...gaps.map(
        (gap, gIndex) =>
          new Paragraph({
            children: [
              new TextRun({
                text: `[NEEDS YOUR INPUT: ${gap}]`,
                bold: true,
                color: "B45309",
              }),
            ],
            spacing: { after: gIndex === gaps.length - 1 ? 300 : 100 },
          })
      )
    );
  });

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}`,
          italics: true,
          size: 18,
        }),
      ],
      spacing: { before: 600 },
    })
  );

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
    creator: "Grant Writing Platform",
    title: `${project.title} - Grant Application`,
    description: `Grant application for ${project.funder}`,
    lastModifiedBy: "Grant Writing Platform",
  });
}

/**
 * Export to Word document (.docx)
 */
export async function exportToWord(data: ExportData): Promise<void> {
  const doc = createWordDocument(data);

  try {
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${sanitizeFilename(data.project.title)}-Grant-Application.docx`);
  } catch (error) {
    console.error("Word export failed:", error);
    throw new Error("Failed to generate Word document. Please try again.");
  }
}

/**
 * Sanitize filename for safe file saving
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .substring(0, 100); // Limit length
}

/**
 * Validate export data before processing
 */
export function validateExportData(data: ExportData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.project) {
    errors.push('Project data is required');
  } else {
    if (!data.project.title) errors.push('Project title is required');
    if (!data.project.funder) errors.push('Project funder is required');
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    errors.push('Questions data is required');
  } else {
    const completedQuestions = data.questions.filter(
      q => q.responseStatus === "complete" || q.responseStatus === "edited"
    );
    if (completedQuestions.length === 0) {
      errors.push('At least one completed question is required for export');
    }
  }

  if (!data.metadata || !data.metadata.exportDate) {
    errors.push('Export metadata is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
