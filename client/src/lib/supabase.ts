import { createClient } from '@supabase/supabase-js'
import { getOAuthRedirectOrigin } from './domains'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail-closed: previous fallbacks pointed dev/preview builds at the
  // production Supabase project and committed the anon key as a literal,
  // which both leaked the project ref and hid env-var misconfigurations.
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      '(or the legacy NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) ' +
      'in the deployment environment before building.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    // Tokens live in localStorage while persistSession is true — any XSS can
    // exfiltrate the JWT. Moving to `@supabase/ssr` cookie sessions would fix
    // that class of theft but requires API routes / middleware wiring; tracked
    // under security backlog if product prioritizes defense-in-depth here.
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Auth helper functions
export const signUp = async (email: string, password: string, metadata?: any) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  })
}

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

/**
 * OAuth redirect target: localhost stays local even when Vite injects a
 * production `VITE_APP_DOMAIN`; deployed builds can still use the configured
 * app domain.
 */
export const signInWithGoogle = async () => {
  const base = getOAuthRedirectOrigin();
  if (!base) {
    throw new Error(
      "OAuth redirect cannot be determined: set VITE_APP_DOMAIN for non-browser contexts, or sign in from the web app.",
    );
  }
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/app`,
    },
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Listen to auth changes
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback)
}
