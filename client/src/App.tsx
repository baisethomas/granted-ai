import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api, User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Route, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Login } from "@/components/Login";
import { Sidebar } from "@/components/layout/sidebar";
import { MainHeader } from "@/components/layout/main-header";

// Import landing page components
import { HeroSection } from "@/components/landing/hero-section";
import { StatsSection } from "@/components/landing/stats-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { FeaturesSection } from "@/components/landing/features-section";
import { TrustSection } from "@/components/landing/trust-section";
import { FAQSection } from "@/components/landing/faq-section";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";
import { ErrorBoundary, AuthErrorFallback } from "@/components/error-boundary";

// Import pages
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Forms from "@/pages/forms";
import Drafts from "@/pages/drafts";
import Settings from "@/pages/settings";
import Pricing from "@/pages/pricing";
import { NewProjectDialog } from "@/components/new-project-dialog";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [location, setLocation] = useLocation();
  const { user, loading, signOut } = useAuth();
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  // Handle redirect to /app when user logs in
  useEffect(() => {
    if (user && location !== "/app") {
      setLocation("/app");
    }
  }, [user, location, setLocation]);

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "upload":
        return <Upload />;
      case "forms":
        return <Forms />;
      case "drafts":
        return <Drafts />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your session...</p>
        </div>
      </div>
    );
  }

  // Logged-out routes: "/" (landing) and "/auth" (login/signup)
  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary fallback={AuthErrorFallback}>
            <Route path="/auth">
              <Login />
            </Route>
            <Route path="/pricing">
              <Pricing />
            </Route>
            <Route path="/">
              <LandingPage
                onClickSeeHow={() => {
                  const el = document.getElementById('how');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onNavigateToAuth={() => setLocation("/auth")}
              />
            </Route>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Show loading during redirect
  if (user && location !== "/app") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="h-screen overflow-hidden">
            <AppLayoutWithTabs 
              activeTab={activeTab} 
              onTabChange={setActiveTab}
              isNewProjectDialogOpen={isNewProjectDialogOpen}
              setIsNewProjectDialogOpen={setIsNewProjectDialogOpen}
            >
              {renderActiveView()}
            </AppLayoutWithTabs>
            <Toaster />
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppLayoutWithTabs({ 
  children, 
  activeTab, 
  onTabChange,
  isNewProjectDialogOpen,
  setIsNewProjectDialogOpen
}: { 
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isNewProjectDialogOpen: boolean;
  setIsNewProjectDialogOpen: (open: boolean) => void;
}) {
  const getHeaderTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Dashboard";
      case "upload":
        return "Upload Documents";
      case "forms":
        return "Grant Forms";
      case "drafts":
        return "Drafts";
      case "settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Welcome to your grant writing workspace";
      case "upload":
        return "Upload and manage your documents";
      case "forms":
        return "Manage your grant application forms";
      case "drafts":
        return "Review and edit your draft responses";
      case "settings":
        return "Manage your account and preferences";
      default:
        return "Welcome to your new project";
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <MainHeader 
          title={getHeaderTitle()} 
          subtitle={getHeaderSubtitle()}
          onNewProject={activeTab === "dashboard" ? () => {
            setIsNewProjectDialogOpen(true);
          } : undefined}
        />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* New Project Dialog - Available from header button */}
      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onOpenChange={setIsNewProjectDialogOpen}
      />
    </div>
  );
}

// Main App component with Supabase AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

function LandingPage({ onClickSeeHow, onNavigateToAuth }: { onClickSeeHow: () => void; onNavigateToAuth: () => void }) {
  const handleSignup = () => {
    onNavigateToAuth();
  };

  const handleLogin = () => {
    onNavigateToAuth();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />
      <HeroSection onClickSeeHow={onClickSeeHow} onNavigateToAuth={onNavigateToAuth} />
      <StatsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TrustSection />
      <FAQSection />
      <CTASection onSignup={handleSignup} onLogin={handleLogin} />
      <Footer />
    </div>
  );
}

function AuthPage({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check for Google auth error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'google_auth_failed') {
      setError('Google authentication failed. Please try again.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await api.login(username, password)
          : await api.signup(username, password, organizationName);
      onAuthed(user);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />
      <div className="max-w-md mx-auto px-6 py-16">
        <Card className="shadow-sm border border-slate-200/70 bg-white">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Log in" : "Create your account"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="org">Organization name (optional)</Label>
                  <Input id="org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                </div>
              )}
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <Button className="w-full" disabled={busy}>
                {busy && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {busy ? (mode === "login" ? "Logging in..." : "Creating account...") : mode === "login" ? "Log in" : "Create account"}
              </Button>
              <Separator />
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = '/auth/google'}
                  disabled={busy}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <div className="text-sm text-slate-600">
                  {mode === "login" ? (
                    <>Don't have an account? <button type="button" className="text-slate-900 underline" onClick={() => setMode("signup")}>Sign up</button></>
                  ) : (
                    <>Already have an account? <button type="button" className="text-slate-900 underline" onClick={() => setMode("login")}>Log in</button></>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MarketingHeader({ onLogout }: { onLogout?: () => void }) {
  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-slate-900 to-slate-700" />
          <span className="font-semibold tracking-tight">Granted</span>
        </div>
        <div className="flex items-center gap-4">
          {!onLogout && (
            <a href="/pricing" className="text-slate-700 hover:text-slate-900">Pricing</a>
          )}
          {onLogout ? (
            <Button variant="outline" onClick={onLogout}>Log out</Button>
          ) : (
            <a href="/auth" className="text-slate-700 hover:text-slate-900">Log in</a>
          )}
        </div>
      </div>
    </header>
  );
}
