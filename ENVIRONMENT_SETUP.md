# Environment Setup Guide

## API Key Configuration for Granted AI

### Overview
This guide helps you properly configure API keys for the AI-powered grant writing platform.

### Current Status
✅ **Mock Implementation Active**: The application now includes fallback mock implementations that work when API keys are missing or invalid. This ensures the development workflow is never blocked.

### Environment Variables Setup

#### 1. Copy the example environment file:
```bash
cp .env.example .env
```

#### 2. Configure your API keys in `.env`:

```env
# Supabase Configuration (for data storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# AI Provider API Keys
OPENAI_API_KEY=sk-proj-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# AI Provider Selection (openai | anthropic)
GRANTED_DEFAULT_PROVIDER=openai

# Security Configuration
# CORS: Comma-separated list of allowed origins (required in production)
# Example: ALLOWED_ORIGINS=https://granted.ai,https://www.granted.ai
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000

# Rate Limiting (optional - defaults shown)
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
AUTH_RATE_LIMIT_MAX_REQUESTS=5       # Max auth attempts per window
UPLOAD_RATE_LIMIT_WINDOW_MS=3600000  # 1 hour
UPLOAD_RATE_LIMIT_MAX_REQUESTS=10    # Max uploads per hour

# Request Body Size Limits (optional - defaults shown)
REQUEST_BODY_LIMIT=1mb               # JSON body size limit
REQUEST_URLENCODED_LIMIT=10mb        # URL-encoded body size limit
```

### API Key Sources

#### OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Copy the key (starts with `sk-proj-`)
4. Add to your `.env` file as `OPENAI_API_KEY=sk-proj-...`

#### Anthropic API Key
1. Visit [Anthropic Console](https://console.anthropic.com/account/keys)
2. Create a new API key
3. Copy the key (starts with `sk-ant-`)
4. Add to your `.env` file as `ANTHROPIC_API_KEY=sk-ant-...`

### Development Mode (Mock Implementation)

When API keys are missing or invalid, the application automatically falls back to mock implementations:

**Question Extraction Mock**:
- Returns 20 realistic grant application questions
- Covers common grant requirements like mission, budget, impact, etc.
- Allows full UI testing without API dependencies

**Document Summarization Mock**:
- Provides intelligent mock summaries based on file names and content
- Recognizes document types (budget, org profile, RFP, etc.)
- Returns contextually appropriate summaries

**Benefits of Mock Mode**:
- ✅ Immediate development environment setup
- ✅ No API costs during development
- ✅ Consistent testing data
- ✅ No rate limiting issues
- ✅ Works offline

### Testing the Setup

#### 1. Start the development server:
```bash
npm run dev
```

#### 2. Test question extraction:
- Upload any document via the upload interface
- Click "Extract Questions from RFP"
- You should see 20 mock questions populate the form

#### 3. Verify API key loading:
Check the server logs for these messages:
- With valid API key: Normal operation, real AI responses
- Without valid API key: "No valid API key found, using mock questions for development..."

### Security Configuration

The application includes several security features that can be configured via environment variables:

#### CORS (Cross-Origin Resource Sharing)
- **Required in production**: Set `ALLOWED_ORIGINS` to a comma-separated list of allowed origins
- **Development**: Defaults to common localhost origins if not configured
- **Example**: `ALLOWED_ORIGINS=https://granted.ai,https://www.granted.ai`

#### Rate Limiting
- **API Rate Limiting**: Prevents abuse of general API endpoints (default: 100 requests per 15 minutes)
- **Auth Rate Limiting**: Stricter limits on authentication endpoints (default: 5 attempts per 15 minutes)
- **Upload Rate Limiting**: Limits file upload frequency (default: 10 uploads per hour)
- All rate limits are configurable via environment variables

#### Request Size Limits
- **JSON Body Limit**: Default 1MB (configurable via `REQUEST_BODY_LIMIT`)
- **URL-encoded Limit**: Default 10MB for form data (configurable via `REQUEST_URLENCODED_LIMIT`)
- Prevents memory exhaustion from large payloads

### Production Deployment

For production deployment, ensure:

1. **Valid API Keys**: Set proper OpenAI or Anthropic API keys
2. **Environment Variables**: Configure all required environment variables
3. **Provider Selection**: Set `GRANTED_DEFAULT_PROVIDER` to your preferred AI provider
4. **Security Configuration**: 
   - **REQUIRED**: Set `ALLOWED_ORIGINS` to your production domain(s)
   - Configure rate limits based on your expected traffic
   - Adjust request size limits if needed for your use case
5. **Error Handling**: The app will still fall back to mock data if API calls fail

### Troubleshooting

#### Common Issues:

**1. Empty Questions Array**:
- **Symptom**: `/api/extract-questions` returns `{"questions":[]}`
- **Solution**: Now automatically returns mock questions as fallback

**2. API Key Errors**:
- **Symptom**: "Incorrect API key provided: default_key"
- **Solution**: Set proper API key in `.env` or rely on mock implementation

**3. Environment Variables Not Loading**:
- **Symptom**: API keys not recognized
- **Solution**: Restart development server after changing `.env`

#### Verification Commands:

```bash
# Check if .env file exists and has API keys
cat .env | grep API_KEY

# Verify server is loading environment variables
# (Check server logs for "No valid API key found..." messages)
```

### Development Workflow

**Recommended Approach**:
1. **Start Development**: Use mock implementation for initial development
2. **Feature Testing**: Implement and test all UI flows with mock data
3. **Integration**: Add real API keys when ready for AI integration testing
4. **Production**: Deploy with proper API keys and monitoring

This approach ensures you can develop and test the complete application workflow without being blocked by API key setup issues.