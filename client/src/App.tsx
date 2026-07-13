import { useEffect, useRef, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Route, Switch, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePostSignupCheckout } from "@/hooks/usePostSignupCheckout";
import { LogoutProvider } from "@/hooks/useLogout";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import { Login } from "@/components/Login";
import { isMarketingDomain, getAuthUrl, APP_DOMAIN } from "@/lib/domains";
import { Sidebar } from "@/components/layout/sidebar";
import { MainHeader } from "@/components/layout/main-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { LAST_OPENED_PROJECT_STORAGE_KEY } from "@/lib/recent-project";

// Import landing page components
import { HeroSection } from "@/components/landing/hero-section";
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
import Settings from "@/pages/settings";
import Organization from "@/pages/organization";
import Pricing from "@/pages/pricing";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import ResetPassword from "@/pages/reset-password";
import PortfolioMetrics from "@/pages/metrics";
import { ProjectDetail } from "@/pages/projects/[id]";
import { NewProjectDialog } from "@/components/new-project-dialog";

// Maps a sidebar/mobile-nav tab id to its real route.
const TAB_PATHS: Record<string, string> = {
  dashboard: "/app",
  organization: "/app/organization",
  upload: "/app/documents",
  metrics: "/app/metrics",
  settings: "/app/settings",
};

// Inverse of TAB_PATHS, for highlighting the active nav item from the URL.
// Application-detail routes intentionally match nothing here — no top-level
// nav item is "active" while viewing a specific application.
function tabForLocation(location: string): string {
  if (location === "/app/organization" || location.startsWith("/app/organization/")) return "organization";
  if (location === "/app/documents" || location.startsWith("/app/documents/")) return "upload";
  if (location === "/app/metrics" || location.startsWith("/app/metrics/")) return "metrics";
  if (location === "/app/settings" || location.startsWith("/app/settings/")) return "settings";
  if (location === "/app" || location === "/app/") return "dashboard";
  return "";
}

// Exact "/app" or "/app/..." — a plain startsWith("/app") would also match
// unrelated paths like "/apple" or "/application".
function isAppRoute(location: string): boolean {
  return location === "/app" || location.startsWith("/app/");
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const { user, loading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  // Also check window.location directly, not just wouter's location state —
  // this is a security-sensitive gate (it decides whether the marketing-
  // domain redirect below can fire), so it must not depend on wouter having
  // finished syncing after a hard cross-domain navigation to this route.
  const isPasswordResetRoute =
    location === "/auth/reset" ||
    (typeof window !== "undefined" && window.location.pathname === "/auth/reset");
  const checkoutRedirecting = usePostSignupCheckout(isPasswordResetRoute ? null : user, loading);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  // Where a project was opened from (Dashboard, Metrics, ...), so the
  // in-page Back button returns there directly instead of using raw browser
  // history — tab clicks inside a project also push history entries (so the
  // native browser Back button can step through them one at a time), which
  // would make history.back() from the project's Back button just undo the
  // last tab click instead of leaving the project. Defaults to the
  // dashboard for a cold-start deep link with no recorded origin.
  const projectOriginRef = useRef("/app");

  const PUBLIC_PATHS = ["/privacy", "/terms", "/pricing"];
  const isPublicPath = PUBLIC_PATHS.includes(location);
  const activeTab = tabForLocation(location);

  // Handle redirect to /app when user logs in
  useEffect(() => {
    if (user && !isAppRoute(location) && !isPublicPath && !isPasswordResetRoute) {
      setLocation("/app");
    }
  }, [user, location, setLocation, isPublicPath, isPasswordResetRoute]);

  // Handle redirect to landing when user logs out from an authenticated route
  useEffect(() => {
    if (!loading && !user && isAppRoute(location)) {
      setLocation("/");
    }
  }, [user, loading, location, setLocation]);

  const handleOpenProject = (projectId: string, tab?: string) => {
    projectOriginRef.current = location;
    window.localStorage.setItem(LAST_OPENED_PROJECT_STORAGE_KEY, projectId);
    setLocation(`/app/applications/${projectId}${tab ? `/${tab}` : ""}`);
  };

  const handleTabChange = (tab: string) => {
    setLocation(TAB_PATHS[tab] ?? "/app");
  };

  if (loading || checkoutRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">
            {checkoutRedirecting ? "Redirecting to secure checkout..." : "Loading your session..."}
          </p>
        </div>
      </div>
    );
  }

  if (isPasswordResetRoute) {
    return <QueryClientProvider client={queryClient}><TooltipProvider><ResetPassword canReset={isPasswordRecovery} onComplete={clearPasswordRecovery} /></TooltipProvider></QueryClientProvider>;
  }

  // Authenticated users on marketing domain → send to the app.
  // isPasswordResetRoute is already handled above and this is unreachable
  // when it's true, but the check is repeated explicitly rather than relied
  // on implicitly — a reset link must never bounce to /app before the user
  // can set a new password, so this invariant should hold regardless of
  // branch ordering above.
  if (!loading && user && isMarketingDomain() && !isPasswordResetRoute) {
    window.location.href = `${APP_DOMAIN}/app`;
    return null;
  }

  // Logged-out routes: "/" (landing) and "/auth" (login/signup)
  if (!user) {
    if (isMarketingDomain() && location === '/auth') {
      window.location.href = `${APP_DOMAIN}/auth`;
      return null;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary fallback={AuthErrorFallback}>
            {!isMarketingDomain() && (
              <Route path="/auth">
                <Login />
              </Route>
            )}
            <Route path="/pricing">
              <Pricing />
            </Route>
            <Route path="/privacy">
              <Privacy />
            </Route>
            <Route path="/terms">
              <Terms />
            </Route>
            <Route path="/">
              <LandingPage
                onClickSeeHow={() => {
                  const el = document.getElementById('how');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onNavigateToAuth={() => {
                  if (isMarketingDomain()) {
                    window.location.href = `${APP_DOMAIN}/auth`;
                  } else {
                    setLocation("/auth");
                  }
                }}
              />
            </Route>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Allow authenticated users to view public legal/marketing pages directly
  if (user && isPublicPath) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <Route path="/pricing">
              <Pricing />
            </Route>
            <Route path="/privacy">
              <Privacy />
            </Route>
            <Route path="/terms">
              <Terms />
            </Route>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Show loading during redirect
  if (user && !isAppRoute(location)) {
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
          <LogoutProvider>
            <WorkspaceProvider>
              <div className="min-h-dvh overflow-x-hidden bg-gray-50 md:h-screen md:overflow-hidden">
                <AppLayoutWithTabs
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  isNewProjectDialogOpen={isNewProjectDialogOpen}
                  setIsNewProjectDialogOpen={setIsNewProjectDialogOpen}
                >
                  <Switch>
                    <Route path="/app/applications/:id/:tab?">
                      <ProjectDetail onBack={() => setLocation(projectOriginRef.current)} />
                    </Route>
                    <Route path="/app/organization">
                      <Organization />
                    </Route>
                    <Route path="/app/documents">
                      <Upload />
                    </Route>
                    <Route path="/app/metrics">
                      <PortfolioMetrics onOpenProject={handleOpenProject} />
                    </Route>
                    <Route path="/app/settings">
                      <Settings />
                    </Route>
                    <Route path="/app">
                      <Dashboard
                        onOpenProject={handleOpenProject}
                        onNewProject={() => setIsNewProjectDialogOpen(true)}
                        onNavigateToDocuments={() => setLocation("/app/documents")}
                      />
                    </Route>
                    <Route path="*">
                      <Dashboard
                        onOpenProject={handleOpenProject}
                        onNewProject={() => setIsNewProjectDialogOpen(true)}
                        onNavigateToDocuments={() => setLocation("/app/documents")}
                      />
                    </Route>
                  </Switch>
                </AppLayoutWithTabs>
                <Toaster />
              </div>
            </WorkspaceProvider>
          </LogoutProvider>
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
  const { activeOrganization, activeOrganizationId } = useWorkspace();
  const getHeaderTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return activeOrganization?.name || "Select a client workspace";
      case "organization":
        return "Organization";
      case "upload":
        return "Documents";
      case "settings":
        return "Settings";
      case "metrics":
        return "Metrics";
      default:
        return "Dashboard";
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Your grant applications, soonest deadline first";
      case "organization":
        return "View and edit the active workspace profile";
      case "upload":
        return "Source material for your grant applications";
      case "settings":
        return "Manage your account and preferences";
      case "metrics":
        return "Track reporting metrics across your grants";
      default:
        return "Welcome to your new project";
    }
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 md:h-screen">
      {/* Sidebar */}
      <div className="hidden md:block">
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <MainHeader 
          title={getHeaderTitle()} 
          subtitle={getHeaderSubtitle()}
          onNewProject={activeTab === "dashboard" ? () => {
            setIsNewProjectDialogOpen(true);
          } : undefined}
          onNavigateToSettings={() => onTabChange("settings")}
          onNavigateToOrganization={() => onTabChange("organization")}
        />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 md:p-6">
          {children}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={onTabChange} />

      {/* New Project Dialog - Available from header button */}
      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onOpenChange={setIsNewProjectDialogOpen}
        organizationId={activeOrganizationId}
        organizationName={activeOrganization?.name}
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
  // The browser resolves URL fragments before React renders, so links like
  // /#early-access (e.g. from the pricing page) need a manual scroll on mount.
  // History scroll restoration can override it after paint, so disable it for
  // hash loads and re-scroll once layout has settled.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!target) return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const scroll = () => document.getElementById(target)?.scrollIntoView({ block: "start" });
    scroll();
    const timer = setTimeout(scroll, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />
      <HeroSection onClickSeeHow={onClickSeeHow} />
      <HowItWorksSection />
      <FeaturesSection />
      <TrustSection />
      <FAQSection />
      <CTASection onLogin={onNavigateToAuth} />
      <Footer />
    </div>
  );
}

function MarketingHeader({ onLogout }: { onLogout?: () => void }) {
  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Granted AI" className="h-12 w-auto" />
        </a>
        <div className="flex items-center gap-4">
          {!onLogout && (
            <a href="/pricing" className="text-slate-700 hover:text-slate-900">Pricing</a>
          )}
          {onLogout ? (
            <Button variant="outline" onClick={onLogout}>Log out</Button>
          ) : (
            <a href={getAuthUrl()} className="text-slate-700 hover:text-slate-900">Log in</a>
          )}
        </div>
      </div>
    </header>
  );
}
