import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'

let authCallback: (event: string, session: any) => void
const unsubscribe = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getCurrentSession: vi.fn().mockResolvedValue(null),
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
    },
  },
}))

function RecoveryState() {
  const { isPasswordRecovery } = useAuth()
  return <span>{isPasswordRecovery ? 'recovery' : 'regular'}</span>
}

describe('AuthProvider password recovery state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only enables password changes after Supabase confirms PASSWORD_RECOVERY', async () => {
    render(<AuthProvider><RecoveryState /></AuthProvider>)
    expect(screen.getByText('regular')).toBeInTheDocument()

    await act(async () => authCallback('SIGNED_IN', { user: { id: 'existing-user' } }))
    expect(screen.getByText('regular')).toBeInTheDocument()

    await act(async () => authCallback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByText('recovery')).toBeInTheDocument()
  })
})
