# Quick Start Guide - Local Development

## Fastest Way to Get Running

### 1. Install Dependencies (if not already done)
```bash
npm install
```

### 2. Create .env File
```bash
cp .env.example .env
```

Then edit `.env` and add at minimum:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-this-to-random-string
```

**Note:** The app will work with mock data if you don't have API keys yet.

### 3. Start Server
```bash
npm run dev
```

### 4. Open Browser
Go to: **http://localhost:3000**

## Minimal Setup (No API Keys)

The app works without API keys for development:
- ✅ Frontend loads
- ✅ UI works
- ✅ Mock data for testing
- ❌ AI generation (needs API keys)
- ❌ Real database (uses in-memory)

## Full Setup (With API Keys)

For full functionality, add to `.env`:
```env
# Supabase (for auth & storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# AI Provider (for generation)
OPENAI_API_KEY=sk-proj-your-key
GRANTED_DEFAULT_PROVIDER=openai

# Database (optional)
DATABASE_URL=postgresql://...
```

## Verify It's Working

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"...","database":"...","supabase":"...","storage":"..."}
```

## Common Issues

**Port in use?**
```bash
PORT=3001 npm run dev
```

**Module errors?**
```bash
rm -rf node_modules && npm install
```

**Can't find .env.example?**
- It should be in the root directory
- If missing, check `LOCAL_SETUP.md` for manual setup

## That's It!

Your server should now be running at `http://localhost:3000` 🎉
