import { useState } from 'react'
import { Link } from 'wouter'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/lib/supabase'

export default function ResetPassword({ canReset }: { canReset: boolean }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [complete, setComplete] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmation) return setError('Passwords do not match. Enter the same password in both fields.')
    setLoading(true); setError('')
    const { error } = await updatePassword(password)
    if (error) setError('We could not update your password. Request a new reset link and try again.')
    else setComplete(true)
    setLoading(false)
  }
  return <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-16"><div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
    <img src="/logo.png" alt="Granted AI" className="h-12 w-auto" />
    <h1 className="mt-6 text-2xl font-bold text-slate-900">{!canReset ? 'Reset link unavailable' : complete ? 'Password updated' : 'Choose a new password'}</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">{!canReset ? 'This reset link is invalid or has expired. Request a new link from the sign-in page.' : complete ? 'Your new password is ready. Continue to your workspace.' : 'Enter a new password for your Granted account.'}</p>
    {!canReset ? <Button asChild variant="outline" className="mt-6 w-full h-11"><Link href="/auth">Return to sign in</Link></Button> : complete ? <Button asChild className="mt-6 w-full h-11"><Link href="/app">Continue to Granted</Link></Button> : <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Button type="submit" disabled={loading} className="w-full h-11">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}</Button>
    </form>}
  </div></div>
}
