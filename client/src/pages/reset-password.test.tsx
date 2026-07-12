import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ResetPassword from './reset-password'
const update = vi.fn()
vi.mock('@/lib/supabase', () => ({ updatePassword: (...a: unknown[]) => update(...a) }))
describe('ResetPassword', () => {
  it('rejects an invalid recovery session', () => { render(<ResetPassword canReset={false}/>); expect(screen.getByRole('heading',{name:'Reset link unavailable'})).toBeInTheDocument(); expect(screen.queryByLabelText('New password')).not.toBeInTheDocument() })
  it('updates the password', async () => { update.mockResolvedValue({error:null}); const u=userEvent.setup(); render(<ResetPassword canReset/>); await u.type(screen.getByLabelText('New password'),'new-password'); await u.type(screen.getByLabelText('Confirm new password'),'new-password'); await u.click(screen.getByRole('button',{name:'Update password'})); expect(update).toHaveBeenCalledWith('new-password'); expect(await screen.findByRole('heading',{name:'Password updated'})).toBeInTheDocument() })
  // Greptile P1 (GRA-63 review): the caller clears recovery authorization
  // once the reset succeeds (single-use). If the "unavailable" branch were
  // checked before "complete" in the ternary, that would flip the success
  // screen back to "Reset link unavailable" the instant canReset goes false.
  it('shows the success screen even if canReset is withdrawn immediately after completing', async () => {
    update.mockResolvedValue({ error: null })
    const u = userEvent.setup()
    const onComplete = vi.fn()
    const { rerender } = render(<ResetPassword canReset onComplete={onComplete} />)
    await u.type(screen.getByLabelText('New password'), 'new-password')
    await u.type(screen.getByLabelText('Confirm new password'), 'new-password')
    await u.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Simulate the parent reacting to onComplete by flipping canReset false.
    rerender(<ResetPassword canReset={false} onComplete={onComplete} />)
    expect(screen.getByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
  })
})
