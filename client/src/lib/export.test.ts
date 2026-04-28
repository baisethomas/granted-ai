import { describe, expect, it } from 'vitest';
import { validateExportData } from './export';
import type { ExportData } from './export';

// Mock data for testing
const mockExportData: ExportData = {
  project: {
    id: '1',
    title: 'Test Grant Application',
    funder: 'Test Foundation',
    amount: '$50,000',
    deadline: '2024-12-31',
    status: 'draft',
    description: 'This is a test grant application for educational purposes.',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  },
  questions: [
    {
      id: '1',
      projectId: '1',
      question: 'What is the main objective of your project?',
      wordLimit: 500,
      priority: 'high',
      response: 'Our main objective is to improve educational outcomes through innovative technology solutions.',
      responseStatus: 'complete',
      createdAt: new Date('2024-01-01')
    },
    {
      id: '2',
      projectId: '1',
      question: 'How will you measure success?',
      wordLimit: 300,
      priority: 'high',
      response: 'We will measure success through standardized test scores, student engagement metrics, and teacher feedback.',
      responseStatus: 'complete',
      createdAt: new Date('2024-01-01')
    }
  ],
  metadata: {
    exportDate: new Date(),
    organizationName: 'Test Educational Organization'
  }
};

describe('export validation', () => {
  it('accepts complete export data', () => {
    const result = validateExportData(mockExportData);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects missing project and question data', () => {
    const invalidData = {
      ...mockExportData,
      project: {
        ...mockExportData.project,
        title: '', // Invalid - empty title
        funder: '' // Invalid - empty funder
      },
      questions: [] // Invalid - no completed questions
    };
    
    const result = validateExportData(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'Project title is required',
      'Project funder is required',
      'At least one completed question is required for export'
    ]);
  });
});
