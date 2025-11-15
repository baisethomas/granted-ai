# Local Development Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be v18+
   ```

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **Git** (to clone the repository)
   ```bash
   git --version
   ```

## Step 1: Clone/Download the Repository

If you're working locally, you already have the code. If not:
```bash
git clone <your-repo-url>
cd granted-ai
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all dependencies from `package.json`.

## Step 3: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration:
   ```bash
   # Required for Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

   # Database (optional - uses in-memory if not set)
   DATABASE_URL=postgresql://user:password@host:5432/database

   # AI Providers (required for AI features)
   OPENAI_API_KEY=sk-proj-your-key-here
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   GRANTED_DEFAULT_PROVIDER=openai

   # Server
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your-random-secret-here

   # Optional
   DOCUMENTS_BUCKET=documents
   DOCUMENT_WORKER_API_KEY=your-worker-key
   ```

## Step 4: Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port you specified in `.env`).

## Step 5: Access the Application

Open your browser and navigate to:
- **Frontend:** `http://localhost:3000`
- **API Health Check:** `http://localhost:3000/api/health`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run lint` - Run ESLint

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
PORT=3001 npm run dev
```

### Missing Environment Variables
The app will work with mock data if API keys are missing, but some features won't work:
- AI generation requires OpenAI or Anthropic API key
- Database features require DATABASE_URL
- File uploads require Supabase configuration

### Database Connection Issues
If you're using PostgreSQL:
- Make sure PostgreSQL is running
- Check DATABASE_URL format: `postgresql://user:password@host:port/database`
- The app will use in-memory storage if DATABASE_URL is not set

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Testing the Setup

1. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   ```
   Should return: `{"status":"ok",...}`

2. **Open in Browser:**
   - Navigate to `http://localhost:3000`
   - You should see the Granted AI landing page

3. **Check Server Logs:**
   - The terminal running `npm run dev` will show request logs
   - Look for structured JSON logs from our logger

## Development Tips

- **Hot Reload:** Changes to server code require restart, frontend code reloads automatically
- **Logs:** Check terminal for structured JSON logs
- **API Testing:** Use `curl` or Postman to test API endpoints
- **Database:** Use Drizzle Studio for database management (if configured)

## Next Steps

Once running locally:
1. Test the health endpoint
2. Try uploading a document
3. Test AI generation (requires API keys)
4. Explore the frontend interface
