import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Login } from './Login'
const signUp = vi.fn(), resend = vi.fn(), reset = vi.fn()
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ signIn: vi.fn(), signUp, signInWithGoogle: vi.fn() }) }))
vi.mock('@/lib/supabase', () => ({ resendSignupConfirmation: (...a: unknown[]) => resend(...a), sendPasswordReset: (...a: unknown[]) => reset(...a) }))
describe('Login recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '/auth'); signUp.mockResolvedValue({ data: { session: null }, error: null }); resend.mockResolvedValue({ error: null }); reset.mockResolvedValue({ error: null }) })
  it('shows confirmation and resends', async () => { const u=userEvent.setup(); render(<Login/>); await u.click(screen.getByRole('button',{name:'Sign up'})); await u.type(screen.getByLabelText('Email address'),'writer@example.org'); await u.type(screen.getByLabelText('Password'),'secure-pass'); await u.click(screen.getByRole('button',{name:'Create account'})); expect(await screen.findByRole('heading',{name:'Check your email'})).toBeInTheDocument(); await u.click(screen.getByRole('button',{name:'Resend confirmation email'})); expect(resend).toHaveBeenCalledWith('writer@example.org'); expect(await screen.findByRole('status')).toBeInTheDocument() })
  it('sends a reset link', async () => { const u=userEvent.setup(); render(<Login/>); await u.click(screen.getByRole('button',{name:'Forgot password?'})); await u.type(screen.getByLabelText('Email address'),'writer@example.org'); await u.click(screen.getByRole('button',{name:'Send reset link'})); expect(reset).toHaveBeenCalledWith('writer@example.org'); expect(await screen.findByText(/We sent a reset link/)).toBeInTheDocument() })
})
