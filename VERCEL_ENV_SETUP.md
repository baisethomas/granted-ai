# Vercel Environment Variables Setup

## Required Environment Variables

Your Vercel deployment needs the following environment variables configured:

### Supabase Configuration

1. **Supabase URL** (choose one):
   - `NEXT_PUBLIC_SUPABASE_URL` (recommended - matches frontend)
   - `SUPABASE_URL`
   - `SUPABASE_PROJECT_URL`
   - `VITE_SUPABASE_URL`

2. **Supabase Service Role Key** (choose one):
   - `SUPABASE_SERVICE_ROLE_KEY` (recommended)
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_SECRET_KEY`

   ⚠️ **Important**: This is the SERVICE ROLE KEY (not the anon key). It bypasses Row Level Security, so keep it secret!

### OpenAI Configuration

- `OPENAI_API_KEY` (or `VITE_OPENAI_API_KEY`)
  - Must start with `sk-`
  - Used for AI response generation

### Optional Configuration

- `GRANTED_DEFAULT_MODEL` - Default OpenAI model (defaults to `gpt-4o-mini`)
- `NODE_ENV` - Set to `production` for production deployments

## How to Add Environment Variables in Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (`granted-ai`)
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Name**: e.g., `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - **Environment**: Select `Production`, `Preview`, and `Development` (or just `Production`)
5. Click **Save**
6. Repeat for all required variables

## Finding Your Supabase Values

1. Go to your Supabase project dashboard
2. Go to **Settings** → **API**
3. **Project URL**: Copy the "Project URL" (this is your `NEXT_PUBLIC_SUPABASE_URL`)
4. **Service Role Key**: Copy the "service_role" key (⚠️ Keep this secret! Never commit to git)

## Finding Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key or copy an existing one
3. The key should start with `sk-`

## After Adding Variables

1. **Redeploy** your application:
   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Click **Redeploy**

   OR

   - Push a new commit to trigger automatic deployment

2. Verify the variables are loaded:
   - Check the deployment logs for any configuration errors
   - The API should now work correctly

## Troubleshooting

### Error: "Server authentication is not configured"
- ✅ Check that `NEXT_PUBLIC_SUPABASE_URL` is set
- ✅ Check that `SUPABASE_SERVICE_ROLE_KEY` is set
- ✅ Make sure you're using the **service_role** key, not the **anon** key
- ✅ Redeploy after adding variables

### Error: "OpenAI API key not configured"
- ✅ Check that `OPENAI_API_KEY` is set
- ✅ Verify the key starts with `sk-`
- ✅ Redeploy after adding variables

### Variables not taking effect
- Environment variables only apply to **new deployments**
- You must **redeploy** after adding/changing variables
- Check that variables are set for the correct environment (Production/Preview/Development)

## Security Notes

- ⚠️ **Never commit** `.env` files or environment variables to git
- ⚠️ The **service_role** key has full database access - keep it secret
- ✅ Vercel encrypts environment variables at rest
- ✅ Variables are only accessible server-side (not exposed to the browser)

