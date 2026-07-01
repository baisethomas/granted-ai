# Granted - AI-Powered Grant Writing Platform

## Overview

Granted is a web-based AI-powered grant writing platform that functions as an agentic assistant for individuals and organizations pursuing grant funding. The application eliminates the complexity and time burden of grant writing by using language models to analyze user-uploaded documents and autonomously generate compelling, customized grant applications.

The platform operates with full agency, drawing from uploaded organizational context to complete tasks without requiring step-by-step user prompting. Users can upload organizational documents (mission statements, past grants, budgets, team information), and the AI assistant will construct a private knowledge base to generate aligned grant responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for development and bundling
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design system
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Navigation**: Single-page application with tab-based navigation system
- **File Structure**: Clean separation with pages, components, hooks, and lib directories

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API structure with organized route handling
- **File Processing**: Multer for file upload handling with configurable storage and size limits
- **AI Integration**: OpenAI GPT-4o integration for content generation with customizable parameters

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless PostgreSQL for cloud hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Data Models**: Comprehensive schema including users, projects, documents, grant questions, response versions, and user settings

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **User Management**: User-based data isolation with project and document ownership
- **Security**: Basic authentication structure ready for expansion

### File Management
- **Upload Handling**: Local file system storage with organized directory structure
- **File Processing**: Support for multiple document formats (PDF, Word, text files)
- **Content Extraction**: AI-powered document summarization and text extraction
- **Categorization**: Document organization by type (organization info, past successes, budgets, team info)

### AI Service Integration
- **Model Selection**: Primary GPT-4o model with fallback options
- **Response Generation**: Context-aware grant response generation with customizable tone and emphasis
- **Document Processing**: Automated document summarization and question extraction
- **Prompt Engineering**: Structured prompts for consistent, high-quality outputs

## External Dependencies

### AI/ML Services
- **OpenAI API**: Primary language model for content generation, document summarization, and question extraction
- **Anthropic SDK**: Secondary AI service integration for model diversity

### Database and Storage
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database operations with automatic migrations

### UI and Component Libraries
- **Radix UI**: Accessible UI primitives for complex components (dialogs, dropdowns, forms)
- **shadcn/ui**: Pre-built component system built on Radix UI
- **Lucide Icons**: Consistent icon system throughout the application
- **TanStack Query**: Server state management and data fetching

### Development and Build Tools
- **Vite**: Fast development server and production bundler
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **ESBuild**: Backend bundling for production deployment

### File Processing
- **Multer**: Multipart form data handling for file uploads
- **File Type Detection**: MIME type validation and processing workflows

### Development Environment
- **Replit Integration**: Development tooling and runtime error handling
- **Hot Module Replacement**: Fast development iteration with Vite HMR