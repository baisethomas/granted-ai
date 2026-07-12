import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'
import { isSignupCheckoutHandled, peekPendingSignupPlan, resolvePendingSignupPlan, setPendingSignupPlan } from '@/lib/signup-plan'

let authCallback: (event: string, session: any) => void
const unsubscribe = vi.fn()
const updateUser = vi.fn().mockResolvedValue({ error: null })
let mockSession: any = null

vi.mock('@/lib/supabase', () => ({
  getCurrentSession: vi.fn(() => Promise.resolve(mockSession)),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof authCallback) => {
        authCallback = callback
        return { data: { subscription: { unsubscribe } } }
      },
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}))

function RecoveryState() {
  const { isPasswordRecovery } = useAuth()
  return <span>{isPasswordRecovery ? 'recovery' : 'regular'}</span>
}

// AuthProvider's mount effect kicks off an async getCurrentSession() lookup
// that resolves on its own microtask tick. Firing a synthetic authCallback
// before that settles races it: the initial lookup's later resolution can
// stomp state the callback just set. Render, then flush once with a no-op
// act() before driving any state through authCallback.
async function renderAuthProvider() {
  const utils = render(<AuthProvider><RecoveryState /></AuthProvider>)
  await act(async () => {})
  return utils
}

describe('AuthProvider password recovery state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateUser.mockResolvedValue({ error: null })
    mockSession = null
    window.sessionStorage.clear()
  })

  it('only enables password changes after Supabase confirms PASSWORD_RECOVERY', async () => {
    render(<AuthProvider><RecoveryState /></AuthProvider>)
    expect(screen.getByText('regular')).toBeInTheDocument()

    await act(async () => authCallback('SIGNED_IN', { user: { id: 'existing-user' } }))
    expect(screen.getByText('regular')).toBeInTheDocument()

    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByText('recovery')).toBeInTheDocument()
  })

  // Greptile P1 (GRA-63 review): an expired/invalid recovery link opened
  // while a different account is already signed in must never enable the
  // reset form for that account — it never fires PASSWORD_RECOVERY, so the
  // existing session alone must not satisfy isPasswordRecovery.
  it('does not treat an unrelated signed-in session as an active recovery', async () => {
    await renderAuthProvider()
    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByText('recovery')).toBeInTheDocument()

    // A different account's session becomes active in the same tab (e.g. the
    // recovery link was actually invalid and the browser's own persisted
    // session for a different user was restored instead).
    await act(async () => authCallback('SIGNED_IN', { user: { id: 'someone-else' } }))
    expect(screen.getByText('regular')).toBeInTheDocument()
  })

  // Greptile P1: a page reload on /auth/reset must not lose recovery
  // authorization — Supabase only fires PASSWORD_RECOVERY once, on the
  // initial hash-token exchange, not on every session restore.
  it('preserves recovery authorization for the same user across a reload', async () => {
    const { unmount } = await renderAuthProvider()
    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByText('recovery')).toBeInTheDocument()
    unmount()

    // Simulate the reload: a fresh provider mount, with Supabase restoring
    // the persisted session for the same user (no new PASSWORD_RECOVERY
    // event — that only fires once).
    mockSession = { user: { id: 'recovery-user' } }
    await renderAuthProvider()
    expect(screen.getByText('recovery')).toBeInTheDocument()
  })

  // Greptile P1: starting recovery must not leave a pending Pro checkout
  // intent that later hijacks the recovering account into Stripe.
  it('clears a pending signup plan when a recovery session is established', async () => {
    setPendingSignupPlan('pro')
    expect(peekPendingSignupPlan()).toBe('pro')

    await renderAuthProvider()
    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))

    expect(peekPendingSignupPlan()).toBeNull()
  })

  // Greptile P1 (round 2): clearing the session-storage intent alone left
  // the checkout resolver's other fallback open — it also reads
  // user.user_metadata.signup_plan (set at signup, independent of whether
  // checkout ever completed), so a recovering user whose original signup
  // wanted Pro would still get auto-redirected to Stripe after finishing
  // their reset. Establishing recovery must close that path too.
  it('tombstones the account so its own signup_plan metadata cannot resolve into a checkout after recovery', async () => {
    const recoveringUser = { id: 'recovery-user', user_metadata: { signup_plan: 'pro' } }
    // Before any recovery flow, this account's metadata alone would resolve
    // a pending Pro checkout — establishing the baseline this fix closes.
    expect(resolvePendingSignupPlan(recoveringUser)).toBe('pro')

    await renderAuthProvider()
    await act(async () => authCallback('PASSWORD_RECOVERY', { user: recoveringUser }))

    expect(updateUser).toHaveBeenCalledWith({ data: { signup_plan: null } })
    expect(isSignupCheckoutHandled('recovery-user')).toBe(true)
    expect(resolvePendingSignupPlan(recoveringUser)).toBeNull()
  })

  it('clears stored recovery authorization on sign-out', async () => {
    await renderAuthProvider()
    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByText('recovery')).toBeInTheDocument()

    await act(async () => authCallback('SIGNED_OUT', null))
    expect(window.sessionStorage.getItem('granted.passwordRecoveryUserId')).toBeNull()
  })
})
