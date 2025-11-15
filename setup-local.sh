#!/bin/bash

# Local Development Setup Script for Granted AI

set -e

echo "🚀 Setting up Granted AI for local development..."
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current: $(node --version)"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
echo "📦 Checking npm..."
echo "✅ npm $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env file and add your configuration:"
        echo "   - SUPABASE_URL and keys (for auth & storage)"
        echo "   - OPENAI_API_KEY or ANTHROPIC_API_KEY (for AI features)"
        echo "   - DATABASE_URL (optional, uses in-memory if not set)"
        echo ""
        echo "   The app will work with mock data if API keys are missing."
    else
        echo "⚠️  .env.example not found. Creating basic .env..."
        cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=$(openssl rand -hex 32)

# Add your API keys here:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_key
# OPENAI_API_KEY=sk-proj-your-key
EOF
        echo "✅ Basic .env file created"
    fi
else
    echo "✅ .env file already exists"
fi
echo ""

# Check if port is available
echo "🔍 Checking if port 3000 is available..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use"
    echo "   You can use a different port: PORT=3001 npm run dev"
else
    echo "✅ Port 3000 is available"
fi
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration (optional for basic testing)"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo ""
echo "For detailed setup instructions, see LOCAL_SETUP.md"
