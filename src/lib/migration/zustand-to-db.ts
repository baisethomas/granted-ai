/**
 * Zustand to Database Migration Utility
 * 
 * This utility migrates data from client-side Zustand stores
 * to server-side database persistence for production reliability.
 */

import { supabaseBrowserClient } from '../supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

export interface ZustandStoreData {
  organizations: {
    settings: {
      tone: string;
      lengthPreference: string;
      emphasisAreas: string[];
    };
  };
  documents: Array<{
    id: string;
    filename: string;
    summary: string;
    processed: boolean;
  }>;
  drafts: Array<{
    id: string;
    content: string;
    projectId: string;
    version: number;
  }>;
  projects: Array<{
    id: string;
    title: string;
    funder: string;
    status: string;
  }>;
}

export class ZustandMigrationService {
  private supabase = supabaseBrowserClient;

  /**
   * Migrate organization settings from Zustand to database
   */
  async migrateOrganizationSettings(
    organizationId: string,
    zustandSettings: ZustandStoreData['organizations']['settings']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await this.supabase
        .from('knowledge_profile')
        .upsert({
          organization_id: organizationId,
          tone: zustandSettings.tone,
          last_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Migrated organization settings to database:', data.id);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to migrate organization settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Migrate documents from Zustand to database
   */
  async migrateDocuments(
    userId: string,
    organizationId: string,
    zustandDocuments: ZustandStoreData['documents']
  ): Promise<{ success: boolean; migratedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      if (!this.supabase) {
        throw new Error('Supabase client not available');
      }

      for (const doc of zustandDocuments) {
        try {
          const { data, error } = await this.supabase
            .from('documents')
            .upsert({
              id: doc.id,
              user_id: userId,
              organization_id: organizationId,
              filename: doc.filename,
              original_name: doc.filename,
              file_type: this.inferFileType(doc.filename),
              file_size: 0, // Unknown from Zustand
              summary: doc.summary,
              processed: doc.processed,
              uploaded_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Migrated document to database:', data.id);
          migratedCount++;
        } catch (error) {
          const errorMsg = `Failed to migrate document ${doc.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      return { 
        success: errors.length === 0, 
        migratedCount, 
        errors 
      };
    } catch (error) {
      console.error('❌ Documents migration failed:', error);
      return { 
        success: false, 
        migratedCount: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Migrate projects from Zustand to database
   */
  async migrateProjects(
    userId: string,
    organizationId: string,
    zustandProjects: ZustandStoreData['projects']
  ): Promise<{ success: boolean; migratedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      if (!this.supabase) {
        throw new Error('Supabase client not available');
      }

      for (const project of zustandProjects) {
        try {
          const { data, error } = await this.supabase
            .from('projects')
            .upsert({
              id: project.id,
              user_id: userId,
              organization_id: organizationId,
              title: project.title,
              funder: project.funder,
              status: project.status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Migrated project to database:', data.id);
          migratedCount++;
        } catch (error) {
          const errorMsg = `Failed to migrate project ${project.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      return { 
        success: errors.length === 0, 
        migratedCount, 
        errors 
      };
    } catch (error) {
      console.error('❌ Projects migration failed:', error);
      return { 
        success: false, 
        migratedCount: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Migrate drafts from Zustand to database
   */
  async migrateDrafts(
    userId: string,
    zustandDrafts: ZustandStoreData['drafts']
  ): Promise<{ success: boolean; migratedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      if (!this.supabase) {
        throw new Error('Supabase client not available');
      }

      for (const draft of zustandDrafts) {
        try {
          const { data, error } = await this.supabase
            .from('drafts')
            .upsert({
              id: draft.id,
              project_id: draft.projectId,
              version: draft.version,
              content: draft.content,
              created_by: userId,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;

          console.log('✅ Migrated draft to database:', data.id);
          migratedCount++;
        } catch (error) {
          const errorMsg = `Failed to migrate draft ${draft.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      return { 
        success: errors.length === 0, 
        migratedCount, 
        errors 
      };
    } catch (error) {
      console.error('❌ Drafts migration failed:', error);
      return { 
        success: false, 
        migratedCount: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Complete migration of all Zustand data
   */
  async migrateAllData(
    userId: string,
    organizationId: string,
    zustandData: ZustandStoreData
  ): Promise<{
    success: boolean;
    summary: {
      organizations: boolean;
      documents: { count: number; success: boolean };
      projects: { count: number; success: boolean };
      drafts: { count: number; success: boolean };
    };
    errors: string[];
  }> {
    console.log('🔄 Starting complete Zustand to database migration...');

    const allErrors: string[] = [];

    // Migrate organization settings
    const orgResult = await this.migrateOrganizationSettings(
      organizationId, 
      zustandData.organizations.settings
    );

    // Migrate documents
    const docsResult = await this.migrateDocuments(
      userId, 
      organizationId, 
      zustandData.documents
    );
    allErrors.push(...docsResult.errors);

    // Migrate projects
    const projectsResult = await this.migrateProjects(
      userId, 
      organizationId, 
      zustandData.projects
    );
    allErrors.push(...projectsResult.errors);

    // Migrate drafts
    const draftsResult = await this.migrateDrafts(userId, zustandData.drafts);
    allErrors.push(...draftsResult.errors);

    const overallSuccess = orgResult.success && 
      docsResult.success && 
      projectsResult.success && 
      draftsResult.success;

    const summary = {
      organizations: orgResult.success,
      documents: { 
        count: docsResult.migratedCount, 
        success: docsResult.success 
      },
      projects: { 
        count: projectsResult.migratedCount, 
        success: projectsResult.success 
      },
      drafts: { 
        count: draftsResult.migratedCount, 
        success: draftsResult.success 
      }
    };

    if (overallSuccess) {
      console.log('✅ Complete migration successful!', summary);
    } else {
      console.log('⚠️ Migration completed with errors:', allErrors);
    }

    return {
      success: overallSuccess,
      summary,
      errors: allErrors
    };
  }

  /**
   * Utility function to infer file type from filename
   */
  private inferFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/msword';
      case 'txt': return 'text/plain';
      case 'csv': return 'text/csv';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Clear Zustand stores after successful migration
   */
  async clearZustandStores(): Promise<void> {
    try {
      // This would typically be called from the client-side to clear stores
      if (typeof window !== 'undefined') {
        localStorage.removeItem('granted-app-store');
        sessionStorage.clear();
        console.log('✅ Cleared Zustand stores from local storage');
      }
    } catch (error) {
      console.error('❌ Failed to clear Zustand stores:', error);
    }
  }
}

/**
 * Singleton migration service
 */
export const migrationService = new ZustandMigrationService();

/**
 * Migration status checker
 */
export async function checkMigrationStatus(organizationId: string): Promise<{
  needsMigration: boolean;
  hasZustandData: boolean;
  hasDatabaseData: boolean;
}> {
  try {
    const supabase = supabaseBrowserClient;
    if (!supabase) {
      return { needsMigration: false, hasZustandData: false, hasDatabaseData: false };
    }

    // Check for existing database data
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(1);

    if (error) throw error;

    const hasDatabaseData = projects && projects.length > 0;
    
    // Check for Zustand data in localStorage
    let hasZustandData = false;
    if (typeof window !== 'undefined') {
      const zustandData = localStorage.getItem('granted-app-store');
      hasZustandData = zustandData !== null;
    }

    const needsMigration = hasZustandData && !hasDatabaseData;

    return {
      needsMigration,
      hasZustandData,
      hasDatabaseData
    };
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return { needsMigration: false, hasZustandData: false, hasDatabaseData: false };
  }
}