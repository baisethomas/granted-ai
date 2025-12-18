# Granted AI Billing & Usage Tracking System

## Overview

This comprehensive billing system provides real-time token metering, plan enforcement, cost control, and usage optimization for the Granted AI platform. It tracks all LLM API calls with <50ms latency, enforces plan limits, and provides detailed analytics and recommendations.

## Features

### 🔍 **Token Metering & Tracking**
- Real-time token counting for OpenAI and Anthropic models
- Cost calculation with accurate pricing per model
- Usage event logging with metadata
- Historical usage analytics

### 📊 **Plan Enforcement**
- Four-tier plan system (Starter, Pro, Team, Enterprise)
- Real-time limit checking for projects, documents, AI credits, team members
- Graceful degradation with upgrade prompts
- Rate limiting and API throttling

### 💰 **Billing Engine**
- Automated billing calculations
- Prorated plan changes
- Overage billing for exceeded limits
- Invoice generation and management

### 🚨 **Cost Control & Alerts**
- Budget alerts at 50%, 80%, and 100% usage
- Usage spike detection
- Inefficiency detection and recommendations
- Customizable alert thresholds

### 🎯 **Optimization Recommendations**
- AI-powered cost optimization suggestions
- Model recommendation for different use cases
- Usage pattern analysis
- Plan optimization guidance

### 💳 **Stripe Integration**
- Subscription management
- Payment processing
- Customer portal
- Webhook handling for real-time updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Granted AI Billing System                   │
├─────────────────────────────────────────────────────────────────┤
│  LLM Providers     │  Token Tracker  │  Plan Enforcement       │
│  - OpenAI          │  - Real-time    │  - Limit checking       │
│  - Anthropic       │  - Cost calc    │  - Graceful fails       │
│  - Usage tracking  │  - Analytics    │  - Upgrade prompts      │
├─────────────────────────────────────────────────────────────────┤
│  Billing Engine    │  Cost Control   │  Optimization Service   │
│  - Calculations    │  - Budgets      │  - Recommendations      │
│  - Invoicing       │  - Alerts       │  - Efficiency scoring   │
│  - Prorations      │  - Forecasting  │  - Model suggestions    │
├─────────────────────────────────────────────────────────────────┤
│  Stripe Integration │  Analytics     │  Database              │
│  - Subscriptions   │  - Dashboards   │  - Usage events        │
│  - Payments        │  - Reports      │  - Budget settings     │
│  - Webhooks        │  - Exports      │  - Optimization data   │
└─────────────────────────────────────────────────────────────────┘
```

## Plan Structure

| Feature | Starter (Free) | Pro ($29/mo) | Team ($99/mo) | Enterprise ($299/mo) |
|---------|----------------|--------------|---------------|---------------------|
| Projects | 3 | 15 | 50 | Unlimited |
| Documents | 25 | 200 | 1,000 | Unlimited |
| AI Credits | 100K/mo | 1M/mo | 5M/mo | Unlimited |
| Team Members | 1 | 5 | 25 | Unlimited |
| Support | Email | Priority | Priority | Dedicated |
| Analytics | Basic | Advanced | Advanced | Enterprise |

## Usage Examples

### Token Tracking

```typescript
import { tokenTracker } from '@/lib/billing';

// Automatic tracking via LLM providers
const provider = getLLMProvider();
await provider.generate({
  instructions: "Write a grant proposal...",
  tracking: {
    organizationId: "org_123",
    userId: "user_456",
    projectId: "proj_789",
  }
});

// Manual tracking
await tokenTracker.trackUsage({
  organizationId: "org_123",
  userId: "user_456",
  type: 'generation',
  provider: 'openai',
  model: 'gpt-4o-mini',
  inputTokens: 150,
  outputTokens: 300,
});
```

### Plan Enforcement

```typescript
import { planEnforcer } from '@/lib/billing';

// Check before creating a project
const canCreate = await planEnforcer.canCreateProject(organizationId);
if (!canCreate.allowed) {
  throw new Error(canCreate.reason);
}

// Check AI request limits
const canGenerate = await planEnforcer.canMakeAIRequest(organizationId, 2000);
if (!canGenerate.allowed) {
  return { error: canGenerate.reason, upgradeRequired: true };
}
```

### Usage Analytics

```typescript
import { analyticsService } from '@/lib/billing';

// Get dashboard data
const dashboard = await analyticsService.getDashboardData(organizationId);

// Export usage data
const csvData = await analyticsService.exportUsageData(
  organizationId,
  startDate,
  endDate
);
```

### Cost Control

```typescript
import { costControlService } from '@/lib/billing';

// Set budget alerts
await costControlService.setBudgetSettings(organizationId, {
  monthlyBudget: 5000, // $50 in cents
  alertThresholds: { warning: 80, critical: 95 },
  emailAlerts: true,
});

// Get spending dashboard
const spending = await costControlService.getSpendingDashboard(organizationId);
```

### Optimization

```typescript
import { optimizationService } from '@/lib/billing';

// Get optimization analysis
const analysis = await optimizationService.generateOptimizationAnalysis(organizationId);

// Get model recommendations
const modelRecs = await optimizationService.getModelRecommendations(organizationId);
```

## API Routes

### GET `/api/billing/usage`
Get current usage and dashboard data
- Query: `organizationId`
- Returns: Usage analytics and dashboard data

### POST `/api/billing/usage`
Track token usage manually
- Body: `{ organizationId, userId, type, provider, model, inputTokens, outputTokens }`
- Returns: `{ success: boolean }`

### GET `/api/billing/limits`
Check plan limits
- Query: `organizationId`, `action` (optional)
- Returns: Limit validation results

### GET `/api/billing/optimization`
Get optimization recommendations
- Query: `organizationId`, `type` (optional)
- Returns: Optimization analysis and recommendations

## Database Schema

### Core Tables

**usage_events** - Track all LLM API calls
```sql
CREATE TABLE usage_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR REFERENCES organizations(id),
  user_id VARCHAR REFERENCES users(id),
  project_id VARCHAR REFERENCES projects(id),
  type TEXT NOT NULL, -- generation, summarization, etc.
  provider TEXT NOT NULL, -- openai, anthropic
  model TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost INTEGER, -- in cents
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**budget_settings** - Organization budget configuration
```sql
CREATE TABLE budget_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR REFERENCES organizations(id) UNIQUE,
  monthly_budget INTEGER, -- in cents
  alert_thresholds JSONB DEFAULT '{"warning": 80, "critical": 95}',
  spike_detection JSONB DEFAULT '{"enabled": true, "threshold": 200}',
  email_alerts BOOLEAN DEFAULT TRUE,
  auto_limits JSONB DEFAULT '{"enabled": false, "pauseAt": 100}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**optimization_recommendations** - AI-generated optimization suggestions
```sql
CREATE TABLE optimization_recommendations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR REFERENCES organizations(id),
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact JSONB NOT NULL,
  implementation JSONB NOT NULL,
  evidence JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Default LLM Provider
GRANTED_DEFAULT_PROVIDER=openai # or anthropic

# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://...
```

## Monitoring & Performance

### Key Metrics
- **Latency**: <50ms added to API calls for token tracking
- **Accuracy**: 99.9% accuracy in token counting and cost calculation
- **Availability**: Real-time plan enforcement prevents overages
- **Analytics**: Usage analytics available within 5 minutes

### Performance Optimizations
- Async token tracking to minimize request latency
- Efficient database queries with proper indexing
- Caching for frequently accessed plan limits
- Background processing for heavy analytics

## Security Considerations

- **Data Privacy**: Usage events contain no sensitive user content
- **Access Control**: All API routes require organization authentication
- **Rate Limiting**: API endpoints protected against abuse
- **Webhook Security**: Stripe webhook signature verification

## Migration & Setup

1. **Database Migration**
   ```bash
   npm run db:migrate
   ```

2. **Stripe Setup**
   - Create Stripe account and products
   - Configure webhook endpoints
   - Set environment variables

3. **LLM Provider Setup**
   - Configure API keys for OpenAI/Anthropic
   - Update default provider preference

4. **Testing**
   ```bash
   npm run test:billing
   ```

## Best Practices

### For Developers
- Always include tracking parameters in LLM calls
- Check plan limits before expensive operations
- Handle graceful failures with upgrade prompts
- Monitor usage patterns for optimization

### For Organizations
- Set appropriate budget alerts
- Review optimization recommendations monthly
- Monitor usage trends and adjust plans accordingly
- Use cost-effective models for routine tasks

## Support & Troubleshooting

### Common Issues
- **High latency**: Check async token tracking configuration
- **Missing usage data**: Verify tracking parameters in LLM calls
- **Inaccurate costs**: Check model pricing configuration
- **Plan limits not enforced**: Verify middleware integration

### Debug Mode
Set `DEBUG_BILLING=true` for detailed logging of all billing operations.

## Roadmap

### Phase 2 Enhancements
- Multi-currency support
- Custom plan creation
- Advanced analytics with ML insights
- Third-party integrations (Zapier, Slack)
- Enterprise SSO and RBAC
- Advanced cost allocation and chargeback

### Phase 3 Features
- Predictive usage modeling
- Automated cost optimization
- Custom billing cycles
- Partner and reseller support
- Advanced security and compliance features