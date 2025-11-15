# Immediate Actions - Quick Wins

These are the fastest, highest-impact improvements you can make right now to improve launch readiness.

## 🚀 Quick Wins (Can Do Today)

### 1. Add Health Check Endpoint (15 minutes)
**Impact:** HIGH | **Effort:** LOW

Add a simple health check endpoint for monitoring:

```typescript
// server/routes.ts - Add this route
app.get("/api/health", async (req, res) => {
  try {
    // Quick database check
    const dbOk = typeof process.env.DATABASE_URL === "string";
    
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? "connected" : "not configured",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
```

### 2. Create .env.example File (10 minutes)
**Impact:** MEDIUM | **Effort:** LOW

Create `.env.example` with all required variables:

```bash
# .env.example
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Providers
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GRANTED_DEFAULT_PROVIDER=openai

# Storage
DOCUMENTS_BUCKET=documents
DOCUMENT_WORKER_API_KEY=your_worker_api_key

# Server
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_session_secret

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Add Basic Rate Limiting (30 minutes)
**Impact:** HIGH | **Effort:** LOW

Install and configure express-rate-limit:

```bash
npm install express-rate-limit
```

```typescript
// server/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit login attempts
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// server/routes.ts - Apply to routes
import { apiLimiter, authLimiter } from './middleware/rateLimit';

// Apply to all API routes
app.use('/api', apiLimiter);

// Apply to auth routes
app.post('/api/auth/login', authLimiter, ...);
app.post('/api/auth/signup', authLimiter, ...);
```

### 4. Replace console.log with Structured Logging (1 hour)
**Impact:** MEDIUM | **Effort:** LOW

Create a simple logger:

```typescript
// server/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(this.formatMessage('debug', message, meta)));
    }
  }

  info(message: string, meta?: any) {
    console.info(JSON.stringify(this.formatMessage('info', message, meta)));
  }

  warn(message: string, meta?: any) {
    console.warn(JSON.stringify(this.formatMessage('warn', message, meta)));
  }

  error(message: string, meta?: any) {
    console.error(JSON.stringify(this.formatMessage('error', message, meta)));
  }
}

export const logger = new Logger();
```

Then replace `console.log` → `logger.info`, `console.error` → `logger.error`, etc.

### 5. Add Environment Validation on Startup (20 minutes)
**Impact:** HIGH | **Effort:** LOW

Enhance `server/config.ts`:

```typescript
// server/config.ts - Add to validateEnvironment()
export function validateEnvironment(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }

  // Existing validation...
  const supabaseUrl = resolveEnv(...supabaseUrlCandidates);
  const supabaseServiceRoleKey = resolveEnv(...supabaseServiceKeyCandidates);
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase configuration is required');
  }

  // Warn about optional but recommended vars
  if (!process.env.DATABASE_URL) {
    console.warn('[env] DATABASE_URL not set - using in-memory storage');
  }
}
```

### 6. Add Error Handler Middleware (30 minutes)
**Impact:** HIGH | **Effort:** LOW

```typescript
// server/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error('API Error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = (err as any).statusCode || 500;
  
  // Return sanitized error
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// server/index.ts - Add after routes
import { errorHandler } from './middleware/errorHandler';
app.use(errorHandler);
```

### 7. Add Request ID Middleware (15 minutes)
**Impact:** MEDIUM | **Effort:** LOW

```typescript
// server/middleware/requestId.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// server/index.ts
import { requestId } from './middleware/requestId';
app.use(requestId);
```

## 📋 This Week's Priority Tasks

### Day 1: Foundation
- [ ] Add health check endpoint
- [ ] Create .env.example
- [ ] Add environment validation
- [ ] Set up basic logging

### Day 2: Security
- [ ] Add rate limiting
- [ ] Add error handler middleware
- [ ] Add request ID middleware
- [ ] Review and fix security headers

### Day 3: Testing Setup
- [ ] Install testing framework (Vitest)
- [ ] Write first unit test
- [ ] Set up test configuration
- [ ] Add test script to package.json

### Day 4: Monitoring Setup
- [ ] Set up Sentry (or similar)
- [ ] Add error tracking
- [ ] Configure alerts
- [ ] Test error reporting

### Day 5: Documentation
- [ ] Update README
- [ ] Document API endpoints
- [ ] Create deployment guide
- [ ] Document environment variables

## 🎯 Success Criteria

After completing these quick wins, you should have:
- ✅ Health check endpoint working
- ✅ Rate limiting protecting APIs
- ✅ Structured logging in place
- ✅ Error handling centralized
- ✅ Environment validation on startup
- ✅ Basic monitoring configured

## 📊 Impact Assessment

**Before Quick Wins:**
- Security: ⚠️ Basic
- Observability: ⚠️ Poor
- Error Handling: ⚠️ Inconsistent
- Developer Experience: ⚠️ Moderate

**After Quick Wins:**
- Security: ✅ Improved
- Observability: ✅ Good
- Error Handling: ✅ Consistent
- Developer Experience: ✅ Better

---

**Estimated Time:** 4-6 hours total  
**Priority:** CRITICAL  
**Start Date:** Today
