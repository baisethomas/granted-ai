import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { DraftStatusBadge } from './DraftStatusBadge';

describe('DraftStatusBadge', () => {
  describe('question status badges', () => {
    it('should render complete status', () => {
      renderWithProviders(<DraftStatusBadge status="complete" />);
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should render edited status', () => {
      renderWithProviders(<DraftStatusBadge status="edited" />);
      expect(screen.getByText('Edited')).toBeInTheDocument();
    });

    it('should render generating status', () => {
      renderWithProviders(<DraftStatusBadge status="generating" />);
      expect(screen.getByText('Generating')).toBeInTheDocument();
    });

    it('should render pending status', () => {
      renderWithProviders(<DraftStatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render unknown status as-is', () => {
      renderWithProviders(<DraftStatusBadge status="custom-status" />);
      expect(screen.getByText('custom-status')).toBeInTheDocument();
    });
  });

  describe('project status badges', () => {
    it('should render final project status', () => {
      renderWithProviders(<DraftStatusBadge status="final" type="project" />);
      expect(screen.getByText('Final')).toBeInTheDocument();
    });

    it('should render draft project status', () => {
      renderWithProviders(<DraftStatusBadge status="draft" type="project" />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should render submitted project status', () => {
      renderWithProviders(<DraftStatusBadge status="submitted" type="project" />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
  });
});
