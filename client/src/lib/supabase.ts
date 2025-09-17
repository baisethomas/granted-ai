import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ieicdrcpckcjgcgfylaj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplaWNkcmNwY2tjamdjaGZ5bGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk1OTQ0NzQsImV4cCI6MjAyNTE3MDQ3NH0.5K_SsPGJMq5I6xOGDgBf9tL7kl7AJ8eAhUpI9BF6TzU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
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

export const signInWithGoogle = async () => {
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/app`
    }
  })
}

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