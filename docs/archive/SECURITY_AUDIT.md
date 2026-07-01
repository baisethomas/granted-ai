# Security Audit: api/simple.ts

## Critical Issues

### 1. **Authorization Bypass - Question Access Control** ⚠️ CRITICAL
**Location**: Lines 245-249, 258-261, 383-392, 415-421

**Issue**: The code fetches and updates questions by ID without verifying ownership. A user could access/modify any question by guessing IDs.

**Current Code**:
```typescript
const { data: question } = await supabaseAdminClient
  .from('grant_questions')
  .select('*')
  .eq('id', questionId)  // ❌ No user_id check!
  .single();
```

**Risk**: Users can read/modify other users' grant questions.

**Fix Required**: Verify question belongs to user's project before allowing access.

---

### 2. **Service Role Key Bypasses RLS** ⚠️ HIGH
**Location**: Throughout file

**Issue**: Using `supabaseAdminClient` (service role key) bypasses Row Level Security policies. While documents are filtered by `user_id`, questions are not.

**Risk**: If manual authorization checks fail, users can access any data.

**Mitigation**: Ensure ALL queries manually verify user ownership.

---

## High Priority Issues

### 3. **Input Validation Missing** ⚠️ HIGH
**Location**: Lines 231-233

**Issue**: No validation on:
- `questionId` (could be malicious string)
- `tone` (could contain injection attempts)
- `emphasisAreas` (could be oversized array causing DoS)

**Risk**: 
- SQL injection (though Supabase client mitigates this)
- DoS attacks via large payloads
- Unexpected behavior from invalid inputs

---

### 4. **Error Information Leakage** ⚠️ MEDIUM
**Location**: Line 428

**Issue**: Full error messages exposed to clients:
```typescript
res.status(500).json({
  error: 'Failed to generate response',
  details: error.message,  // ❌ Could leak sensitive info
  canRetry: true
});
```

**Risk**: Error messages could reveal:
- Database structure
- API keys (if accidentally logged)
- Internal system details

---

### 5. **No Rate Limiting** ⚠️ MEDIUM
**Location**: Line 230

**Issue**: AI generation endpoint has no rate limiting.

**Risk**: 
- Cost attacks (expensive OpenAI API calls)
- DoS attacks
- Resource exhaustion

---

### 6. **CORS Too Permissive** ⚠️ MEDIUM
**Location**: Lines 100-107

**Issue**: CORS allows all origins (`*`):
```typescript
res.header('Access-Control-Allow-Origin', '*');
```

**Risk**: Any website can make requests to your API (though auth still required).

---

## Medium Priority Issues

### 7. **No Request Size Limits** ⚠️ MEDIUM
**Issue**: No explicit limits on request body size beyond Express defaults.

**Risk**: Large payloads could cause memory issues.

---

### 8. **User Data in AI Prompts** ⚠️ LOW-MEDIUM
**Location**: Line 313

**Issue**: Full user object sent to OpenAI:
```typescript
Organization info: ${user ? JSON.stringify(user) : 'N/A'}
```

**Risk**: Could include sensitive user data in AI prompts (though likely minimal).

---

## Recommendations

### Immediate Fixes Required:

1. **Add question ownership verification**:
   ```typescript
   // Verify question belongs to user's project
   const { data: question } = await supabaseAdminClient
     .from('grant_questions')
     .select(`
       *,
       projects!inner(user_id)
     `)
     .eq('id', questionId)
     .eq('projects.user_id', userId)
     .single();
   ```

2. **Add input validation**:
   ```typescript
   // Validate questionId is UUID format
   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionId)) {
     return res.status(400).json({ error: "Invalid question ID" });
   }
   
   // Validate tone
   const validTones = ['professional', 'conversational', 'formal'];
   if (tone && !validTones.includes(tone)) {
     return res.status(400).json({ error: "Invalid tone" });
   }
   
   // Limit emphasisAreas size
   if (emphasisAreas.length > 10) {
     return res.status(400).json({ error: "Too many emphasis areas" });
   }
   ```

3. **Sanitize error messages**:
   ```typescript
   res.status(500).json({
     error: 'Failed to generate response',
     ...(process.env.NODE_ENV === 'development' && { details: error.message }),
     canRetry: true
   });
   ```

4. **Add rate limiting** (use middleware like `express-rate-limit`)

5. **Restrict CORS** to specific origins:
   ```typescript
   const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
   const origin = req.headers.origin;
   if (allowedOrigins.includes(origin)) {
     res.header('Access-Control-Allow-Origin', origin);
   }
   ```

---

## Positive Security Aspects ✅

1. ✅ **Authentication Required**: All endpoints use `requireSupabaseUser` middleware
2. ✅ **Parameterized Queries**: Supabase client prevents SQL injection
3. ✅ **Environment Variables**: API keys stored in env vars (not hardcoded)
4. ✅ **User Filtering**: Documents and chunks correctly filtered by `user_id`
5. ✅ **HTTPS**: Vercel enforces HTTPS in production

---

## Summary

**Critical**: 1 issue (authorization bypass)
**High**: 2 issues (RLS bypass, input validation)
**Medium**: 3 issues (error leakage, rate limiting, CORS)
**Low**: 1 issue (user data in prompts)

**Overall Risk Level**: 🔴 **HIGH** - Authorization bypass must be fixed immediately.

