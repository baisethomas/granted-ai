import { NextRequest, NextResponse } from 'next/server';

/**
 * Consolidated API Route Mapper
 * 
 * This endpoint provides a mapping of all available API routes
 * in the consolidated Next.js 15 architecture, replacing the Express.js routes.
 */
export async function GET() {
  const apiMapping = {
    // Authentication & Users
    auth: {
      login: '/api/auth/login',
      signup: '/api/auth/signup', 
      logout: '/api/auth/logout',
      me: '/api/auth/me',
      refresh: '/api/auth/refresh'
    },

    // Organizations & Projects
    organizations: {
      create: '/api/organizations',
      get: '/api/organizations/:id',
      update: '/api/organizations/:id',
      members: '/api/organizations/:id/members'
    },
    
    projects: {
      list: '/api/projects',
      create: '/api/projects',
      get: '/api/projects/:id',
      update: '/api/projects/:id',
      delete: '/api/projects/:id',
      finalize: '/api/projects/:id/finalize'
    },

    // Document Management
    documents: {
      list: '/api/documents',
      upload: '/api/documents/upload',
      get: '/api/documents/:id',
      delete: '/api/documents/:id',
      summary: '/api/documents/:id/summary'
    },

    // Grant Questions & Generation
    questions: {
      list: '/api/projects/:projectId/questions',
      create: '/api/projects/:projectId/questions',
      get: '/api/questions/:id',
      update: '/api/questions/:id',
      generate: '/api/questions/:id/generate',
      retry: '/api/questions/:id/retry',
      updateResponse: '/api/questions/:id/response',
      versions: '/api/questions/:id/versions'
    },

    // Extract questions from RFP files
    extraction: {
      extractQuestions: '/api/extract-questions'
    },

    // AI Generation (Legacy - use questions/generate instead)
    generate: '/api/generate',
    summarize: '/api/summarize',

    // RAG Pipeline
    rag: {
      processDocument: '/api/rag/process-document',
      search: '/api/rag/search',
      generateContext: '/api/rag/generate-context'
    },

    // Citation System
    citations: {
      validate: '/api/citations/validate',
      evidenceMap: '/api/citations/evidence-map'
    },

    // Clarification Engine
    clarifications: {
      analyze: '/api/clarifications/analyze',
      session: '/api/clarifications/session',
      assumptions: '/api/clarifications/assumptions',
      assumptionTracking: '/api/clarifications/assumption-tracking',
      followUp: '/api/clarifications/follow-up',
      analytics: '/api/clarifications/analytics',
      test: '/api/clarifications/test'
    },

    // Billing & Usage Tracking
    billing: {
      usage: '/api/billing/usage',
      limits: '/api/billing/limits',
      optimization: '/api/billing/optimization'
    },

    // User Settings & Statistics
    settings: '/api/settings',
    stats: '/api/stats'
  };

  return NextResponse.json({
    version: '2.0.0',
    architecture: 'Next.js 15 Consolidated',
    description: 'Granted AI API - Unified architecture with all agent systems',
    endpoints: apiMapping,
    agentSystems: {
      rag: {
        status: 'active',
        description: 'Retrieval-Augmented Generation with pgvector',
        endpoints: ['rag/*']
      },
      citations: {
        status: 'active', 
        description: 'Paragraph-level source attribution and evidence mapping',
        endpoints: ['citations/*']
      },
      clarifications: {
        status: 'active',
        description: 'Intelligent gap analysis and assumption detection',
        endpoints: ['clarifications/*']
      },
      billing: {
        status: 'active',
        description: 'Usage tracking, plan enforcement, and cost optimization',
        endpoints: ['billing/*']
      }
    },
    migration: {
      from: 'Express.js + Next.js Hybrid',
      to: 'Next.js 15 Unified',
      status: 'complete',
      legacyEndpointsRemoved: [
        'Express /api/* routes moved to Next.js API routes',
        'Vite dev server replaced with Next.js dev server',
        'Passport.js auth replaced with Next.js middleware'
      ]
    }
  });
}