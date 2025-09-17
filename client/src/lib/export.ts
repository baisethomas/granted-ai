import jsPDF from 'jspdf';
import html2pdf from 'html2pdf.js';
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

/**
 * Enhanced clipboard export with professional formatting
 */
export async function exportToClipboard(data: ExportData): Promise<void> {
  const { project, questions, metadata } = data;
  
  const completedQuestions = questions.filter(
    q => q.responseStatus === "complete" || q.responseStatus === "edited"
  );

  const header = metadata.organizationName 
    ? `${metadata.organizationName} - Grant Application\n\n`
    : 'Grant Application\n\n';

  const projectInfo = [
    `Project Title: ${project.title}`,
    `Funder: ${project.funder}`,
    project.amount ? `Amount Requested: ${project.amount}` : null,
    project.deadline ? `Application Deadline: ${new Date(project.deadline).toLocaleDateString()}` : null,
    '',
    project.description ? `Project Description:\n${project.description}\n` : '',
  ].filter(Boolean).join('\n');

  const responses = completedQuestions
    .map((q, index) => {
      const wordCount = q.response ? q.response.trim().split(/\s+/).length : 0;
      const wordLimitText = q.wordLimit ? ` (${wordCount}/${q.wordLimit} words)` : ` (${wordCount} words)`;
      
      return [
        `${index + 1}. ${q.question}${wordLimitText}`,
        '',
        q.response || 'No response provided',
        '',
        '---',
        ''
      ].join('\n');
    })
    .join('\n');

  const footer = `\nGenerated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}`;

  const fullText = [
    header,
    projectInfo,
    'Grant Application Responses:',
    '',
    responses,
    footer
  ].join('\n');

  try {
    await navigator.clipboard.writeText(fullText);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = fullText;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

/**
 * Export to PDF with professional formatting
 */
export async function exportToPDF(data: ExportData): Promise<void> {
  const { project, questions, metadata } = data;
  
  const completedQuestions = questions.filter(
    q => q.responseStatus === "complete" || q.responseStatus === "edited"
  );

  // Create HTML content for better formatting
  const htmlContent = createHTMLContent(data, completedQuestions);
  
  // Create a temporary div for html2pdf
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  element.style.position = 'fixed';
  element.style.top = '-9999px';
  element.style.left = '-9999px';
  element.style.width = '210mm'; // A4 width
  document.body.appendChild(element);

  const options = {
    margin: [20, 20, 20, 20],
    filename: `${sanitizeFilename(project.title)}-Grant-Application.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      letterRendering: true,
      allowTaint: false
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  try {
    await html2pdf().set(options).from(element).save();
  } finally {
    document.body.removeChild(element);
  }
}

/**
 * Export to Word document (.docx)
 */
export async function exportToWord(data: ExportData): Promise<void> {
  const { project, questions, metadata } = data;
  
  const completedQuestions = questions.filter(
    q => q.responseStatus === "complete" || q.responseStatus === "edited"
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
            size: 32
          })
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 }
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Grant Application",
            bold: true,
            size: 32
          })
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 }
      })
    );
  }

  // Project Information
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Project Information", bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );

  const projectInfo = [
    [`Project Title:`, project.title],
    [`Funder:`, project.funder],
    ...(project.amount ? [['Amount Requested:', project.amount]] : []),
    ...(project.deadline ? [['Application Deadline:', new Date(project.deadline).toLocaleDateString()]] : []),
  ];

  projectInfo.forEach(([label, value]) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: label, bold: true }),
          new TextRun({ text: ` ${value}` })
        ],
        spacing: { after: 100 }
      })
    );
  });

  // Project Description
  if (project.description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Project Description:", bold: true })],
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        children: [new TextRun({ text: project.description })],
        spacing: { after: 400 }
      })
    );
  }

  // Grant Application Responses
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Grant Application Responses", bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );

  // Questions and Responses
  completedQuestions.forEach((question, index) => {
    const wordCount = question.response ? question.response.trim().split(/\s+/).length : 0;
    const wordLimitText = question.wordLimit ? ` (${wordCount}/${question.wordLimit} words)` : ` (${wordCount} words)`;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ 
            text: `${index + 1}. ${question.question}${wordLimitText}`, 
            bold: true,
            size: 22
          })
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }),
      new Paragraph({
        children: [new TextRun({ text: question.response || 'No response provided' })],
        spacing: { after: 300 }
      })
    );
  });

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({ 
          text: `Generated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}`,
          italics: true,
          size: 18
        })
      ],
      spacing: { before: 600 }
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }],
    creator: "Grant Writing Platform",
    title: `${project.title} - Grant Application`,
    description: `Grant application for ${project.funder}`,
    lastModifiedBy: "Grant Writing Platform"
  });

  try {
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${sanitizeFilename(project.title)}-Grant-Application.docx`);
  } catch (error) {
    console.error('Word export failed:', error);
    throw new Error('Failed to generate Word document. Please try again.');
  }
}

/**
 * Create HTML content for PDF export
 */
function createHTMLContent(data: ExportData, completedQuestions: GrantQuestion[]): string {
  const { project, metadata } = data;

  const styles = `
    <style>
      @page { 
        margin: 2cm; 
        size: A4; 
      }
      body { 
        font-family: 'Times New Roman', serif; 
        line-height: 1.6; 
        color: #333; 
        max-width: 100%; 
        margin: 0;
        font-size: 12pt;
      }
      .header { 
        text-align: center; 
        margin-bottom: 30px; 
        border-bottom: 2px solid #2563eb;
        padding-bottom: 15px;
      }
      .header h1 { 
        font-size: 24pt; 
        font-weight: bold; 
        margin: 0 0 10px 0; 
        color: #1e40af;
      }
      .project-info { 
        background-color: #f8fafc; 
        padding: 20px; 
        margin-bottom: 25px; 
        border-left: 4px solid #2563eb;
        page-break-inside: avoid;
      }
      .project-info h2 { 
        font-size: 16pt; 
        font-weight: bold; 
        margin: 0 0 15px 0; 
        color: #1e40af;
      }
      .info-row { 
        margin-bottom: 8px; 
      }
      .info-label { 
        font-weight: bold; 
        display: inline-block; 
        width: 150px; 
      }
      .description { 
        margin-top: 15px; 
        padding-top: 15px; 
        border-top: 1px solid #e2e8f0; 
      }
      .responses-section { 
        margin-top: 30px; 
      }
      .responses-section h2 { 
        font-size: 18pt; 
        font-weight: bold; 
        margin: 0 0 20px 0; 
        color: #1e40af;
        border-bottom: 1px solid #2563eb;
        padding-bottom: 5px;
      }
      .question-block { 
        margin-bottom: 30px; 
        page-break-inside: avoid; 
      }
      .question-header { 
        font-size: 14pt; 
        font-weight: bold; 
        margin-bottom: 10px; 
        color: #374151;
        background-color: #f1f5f9;
        padding: 10px;
        border-radius: 4px;
      }
      .word-count { 
        font-size: 10pt; 
        color: #6b7280; 
        font-weight: normal; 
      }
      .response-content { 
        margin-bottom: 15px; 
        text-align: justify; 
        padding-left: 15px;
        border-left: 3px solid #e2e8f0;
        padding-top: 10px;
        padding-bottom: 10px;
      }
      .footer { 
        margin-top: 40px; 
        text-align: center; 
        font-size: 10pt; 
        color: #6b7280; 
        border-top: 1px solid #e2e8f0; 
        padding-top: 15px; 
      }
      .page-break { 
        page-break-before: always; 
      }
    </style>
  `;

  const header = `
    <div class="header">
      <h1>${metadata.organizationName ? `${metadata.organizationName} - Grant Application` : 'Grant Application'}</h1>
    </div>
  `;

  const projectInfoItems = [
    `<div class="info-row"><span class="info-label">Project Title:</span> ${project.title}</div>`,
    `<div class="info-row"><span class="info-label">Funder:</span> ${project.funder}</div>`,
    project.amount ? `<div class="info-row"><span class="info-label">Amount Requested:</span> ${project.amount}</div>` : '',
    project.deadline ? `<div class="info-row"><span class="info-label">Application Deadline:</span> ${new Date(project.deadline).toLocaleDateString()}</div>` : '',
  ].filter(Boolean).join('');

  const projectInfo = `
    <div class="project-info">
      <h2>Project Information</h2>
      ${projectInfoItems}
      ${project.description ? `
        <div class="description">
          <div class="info-label">Project Description:</div>
          <div>${project.description.replace(/\n/g, '<br>')}</div>
        </div>
      ` : ''}
    </div>
  `;

  const responses = completedQuestions.map((question, index) => {
    const wordCount = question.response ? question.response.trim().split(/\s+/).length : 0;
    const wordLimitText = question.wordLimit ? ` <span class="word-count">(${wordCount}/${question.wordLimit} words)</span>` : ` <span class="word-count">(${wordCount} words)</span>`;
    
    return `
      <div class="question-block">
        <div class="question-header">
          ${index + 1}. ${question.question}${wordLimitText}
        </div>
        <div class="response-content">
          ${(question.response || 'No response provided').replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
  }).join('');

  const responsesSection = `
    <div class="responses-section">
      <h2>Grant Application Responses</h2>
      ${responses}
    </div>
  `;

  const footer = `
    <div class="footer">
      Generated on: ${metadata.exportDate.toLocaleDateString()} at ${metadata.exportDate.toLocaleTimeString()}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${project.title} - Grant Application</title>
      ${styles}
    </head>
    <body>
      ${header}
      ${projectInfo}
      ${responsesSection}
      ${footer}
    </body>
    </html>
  `;
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