// Simple test to verify export functionality
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

// Test validation function
export function testExportValidation(): boolean {
  try {
    const result = validateExportData(mockExportData);
    console.log('Validation result:', result);
    
    if (!result.valid) {
      console.error('Validation failed:', result.errors);
      return false;
    }
    
    console.log('✅ Export data validation passed');
    return true;
  } catch (error) {
    console.error('❌ Export validation test failed:', error);
    return false;
  }
}

// Test invalid data
export function testExportValidationWithInvalidData(): boolean {
  try {
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
    
    if (result.valid) {
      console.error('❌ Validation should have failed for invalid data');
      return false;
    }
    
    console.log('✅ Validation correctly rejected invalid data:', result.errors);
    return true;
  } catch (error) {
    console.error('❌ Invalid data validation test failed:', error);
    return false;
  }
}

// Run tests
if (typeof window !== 'undefined') {
  // Browser environment - we can run these tests
  console.log('🧪 Running export functionality tests...');
  
  const test1 = testExportValidation();
  const test2 = testExportValidationWithInvalidData();
  
  if (test1 && test2) {
    console.log('✅ All export tests passed!');
  } else {
    console.log('❌ Some export tests failed');
  }
}