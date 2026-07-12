import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, signIn, signUp, signOut, signInWithGoogle, getCurrentSession } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { prepareExplicitProCheckout } from '@/lib/signup-plan'

// Recovery authorization is tied to a specific user id and persisted across
// a page reload (a normal browser refresh on /auth/reset must not lock the
// user out — Supabase only fires PASSWORD_RECOVERY once, on the initial
// hash-token exchange). Scoping it to the user id — not a bare boolean —
// means a stale or cross-account session can never be mistaken for an
// active recovery transaction: whoever is signed in must match whoever the
// recovery link was for.
const RECOVERY_STORAGE_KEY = 'granted.passwordRecoveryUserId'

function readRecoveryUserId(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(RECOVERY_STORAGE_KEY)
}

function writeRecoveryUserId(userId: string | null): void {
  if (typeof window === 'undefined') return
  if (userId) window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, userId)
  else window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY)
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, metadata?: any) => Promise<any>
  signInWithGoogle: () => Promise<any>
  signOut: () => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(() => readRecoveryUserId())

  const clearPasswordRecovery = () => {
    writeRecoveryUserId(null)
    setRecoveryUserId(null)
  }

  useEffect(() => {
    // Get initial session
    getCurrentSession().then((session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        if (event === 'PASSWORD_RECOVERY' && session?.user?.id) {
          writeRecoveryUserId(session.user.id)
          setRecoveryUserId(session.user.id)
          // A recovery session in flight is never a legitimate paid-checkout
          // intent. clearPendingSignupPlan() alone only covers the
          // session-storage intent (e.g. a visitor who opened
          // /auth?plan=pro then used "Forgot password?") — the checkout
          // resolver also falls back to the account's own
          // user_metadata.signup_plan (set at signup, independent of
          // whether checkout was ever completed), so a recovering user
          // needs the full clear-and-tombstone treatment or that fallback
          // still fires Stripe checkout once usePostSignupCheckout sees
          // them land on /app.
          void prepareExplicitProCheckout(session.user.id)
        }
        // Clear cached API data when the session ends so stale data
        // is never shown to the next user or after a token expiry.
        if (event === 'SIGNED_OUT') {
          clearPasswordRecovery()
          queryClient.clear()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Tied to the currently active user, not a bare boolean: an expired or
  // invalid recovery link opened while a different account is already
  // signed in never fires PASSWORD_RECOVERY, so recoveryUserId stays unset
  // (or set to someone else) and this correctly evaluates to false —
  // "any persisted session" can never satisfy it, only a confirmed recovery
  // event for the exact account currently loaded.
  const isPasswordRecovery = Boolean(recoveryUserId) && recoveryUserId === (user?.id ?? null)

  const value: AuthContextType = {
    user,
    session,
    loading,
    isPasswordRecovery,
    clearPasswordRecovery,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
