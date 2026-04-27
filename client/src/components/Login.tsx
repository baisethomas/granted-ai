import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn, signUp, signInWithGoogle } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password)

      if (error) {
        setError(error.message)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  const highlights = [
    'Reuse your organization context across every application',
    'Draft funder-aligned answers in minutes, not days',
    'Keep versions organized and review-ready before export',
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Granted AI" className="h-12 w-auto" />
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="hidden lg:block">
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              AI grant drafting workspace
            </div>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
                Welcome back to Granted
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
              Sign in to pick up where you left off, or create an account to start turning your
              organization's story into stronger grant drafts.
            </p>
            <ul className="mt-8 space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-a)]" />
                  <span className="text-base leading-6">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 relative">
              <div className="absolute inset-6 rounded-3xl bg-gradient-to-br from-[var(--brand-a)]/10 via-[var(--brand-b)]/10 to-[var(--brand-c)]/20 blur-2xl" />
              <img
                src="/generated-graphics/grant-abstract-2.png"
                alt="Illustration of a nonprofit professional reviewing grant materials"
                className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
              />
            </div>
          </div>

          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
                  Welcome to Granted
                </span>
              </h1>
              <p className="mt-2 text-slate-600">
                Sign in to keep drafting, or create an account to get started.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {isSignUp ? 'Create your account' : 'Sign in to your account'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isSignUp
                    ? 'Start drafting funder-aligned responses in minutes.'
                    : 'Welcome back. Pick up where you left off.'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full h-11"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                  <span className="px-3 bg-white text-slate-500">or with email</span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@organization.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    placeholder={isSignUp ? 'Create a password' : 'Your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full h-11"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isSignUp ? (
                    'Create account'
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  className="font-semibold text-[var(--brand-a)] hover:underline"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError('')
                  }}
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              By continuing, you agree to our{' '}
              <a href="/terms" className="underline hover:text-slate-700">Terms</a> and{' '}
              <a href="/privacy" className="underline hover:text-slate-700">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
