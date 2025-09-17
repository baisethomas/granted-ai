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

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((error) => {
        // Don't log auth errors - they're expected for logged-out users
        if (!error.message.includes('401') && !error.message.includes('403')) {
          console.error('Failed to check authentication status:', error);
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
              <AuthPage onAuthed={(u) => { setUser(u); }} />
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
          <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <MarketingHeader onLogout={async () => { await api.logout(); setUser(null); setLocation("/"); }} />
            <AppLayoutWithTabs activeTab={activeTab} onTabChange={setActiveTab}>
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
  onTabChange 
}: { 
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavigation activeTab={activeTab} onTabChange={onTabChange} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

function AppNavigation({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: string; 
  onTabChange: (tab: string) => void; 
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-th-large" },
    { id: "upload", label: "Upload", icon: "fas fa-cloud-upload-alt" },
    { id: "forms", label: "Grant Forms", icon: "fas fa-file-alt" },
    { id: "drafts", label: "Drafts", icon: "fas fa-eye" },
    { id: "settings", label: "Settings", icon: "fas fa-cog" },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-edit text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Granted</h1>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "text-primary-600 bg-primary-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <i className={`${item.icon} mr-2`}></i>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <i className="fas fa-bell text-lg"></i>
            </button>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </div>
          <div className="w-8 h-8 bg-slate-300 rounded-full"></div>
        </div>
      </div>
    </nav>
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
              <div className="text-sm text-slate-600">
                {mode === "login" ? (
                  <>Don’t have an account? <button type="button" className="text-slate-900 underline" onClick={() => setMode("signup")}>Sign up</button></>
                ) : (
                  <>Already have an account? <button type="button" className="text-slate-900 underline" onClick={() => setMode("login")}>Log in</button></>
                )}
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
