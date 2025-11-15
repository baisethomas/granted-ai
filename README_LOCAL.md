# Local Development - README

## Quick Start

### Option 1: Use the Setup Script (Recommended)
```bash
./setup-local.sh
```

Then:
```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys (optional for basic testing).

3. **Start the server:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   - Frontend: http://localhost:3000
   - API Health: http://localhost:3000/api/health

## What You Need

### Required
- Node.js v18+ (`node --version`)
- npm (`npm --version`)

### Optional (for full functionality)
- Supabase account (for auth & storage)
- OpenAI or Anthropic API key (for AI features)
- PostgreSQL database (or use in-memory storage)

## Project Structure

```
/workspace
├── client/          # React frontend (Vite)
├── server/          # Express.js backend
├── shared/          # Shared TypeScript types
├── .env.example     # Environment variables template
└── package.json     # Dependencies and scripts
```

## Available Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check TypeScript
- `npm run lint` - Run ESLint

## Environment Variables

See `.env.example` for all available options. Minimum required:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-secret
```

## Troubleshooting

**Port already in use?**
```bash
PORT=3001 npm run dev
```

**Module errors?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Can't access localhost?**
- Make sure the server is running (check terminal)
- Try `http://127.0.0.1:3000` instead
- Check firewall settings

## Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"...","database":"...","supabase":"...","storage":"..."}
```

## Documentation

- `LOCAL_SETUP.md` - Detailed setup instructions
- `QUICK_START.md` - Fastest way to get running
- `.env.example` - All environment variables explained

## Need Help?

1. Check `LOCAL_SETUP.md` for detailed instructions
2. Verify Node.js version: `node --version` (should be v18+)
3. Check server logs in terminal for errors
4. Test API with: `curl http://localhost:3000/api/health`
