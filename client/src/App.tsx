import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Route, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LogoutProvider } from "@/hooks/useLogout";
import { Login } from "@/components/Login";
import { isMarketingDomain, getAuthUrl, APP_DOMAIN } from "@/lib/domains";
import { Sidebar } from "@/components/layout/sidebar";
import { MainHeader } from "@/components/layout/main-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

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
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import PortfolioMetrics from "@/pages/metrics";
import { ProjectDetail } from "@/pages/projects/[id]";
import { NewProjectDialog } from "@/components/new-project-dialog";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { user, loading, signOut } = useAuth();
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  const PUBLIC_PATHS = ["/privacy", "/terms", "/pricing"];
  const isPublicPath = PUBLIC_PATHS.includes(location);

  // Handle redirect to /app when user logs in
  useEffect(() => {
    if (user && location !== "/app" && !isPublicPath) {
      setLocation("/app");
    }
  }, [user, location, setLocation, isPublicPath]);

  // Handle redirect to landing when user logs out from an authenticated route
  useEffect(() => {
    if (!loading && !user && location === "/app") {
      setLocation("/");
    }
  }, [user, loading, location, setLocation]);

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleCloseProject = () => {
    setSelectedProjectId(null);
  };

  const handleTabChange = (tab: string) => {
    setSelectedProjectId(null);
    setActiveTab(tab);
  };

  const renderActiveView = () => {
    if (selectedProjectId) {
      return <ProjectDetail projectId={selectedProjectId} onBack={handleCloseProject} />;
    }
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onOpenProject={handleOpenProject} />;
      case "upload":
        return <Upload />;
      case "forms":
        return <Forms />;
      case "drafts":
        return <Drafts />;
      case "metrics":
        return <PortfolioMetrics onOpenProject={handleOpenProject} />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onOpenProject={handleOpenProject} />;
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

  // Authenticated users on marketing domain → send to the app
  if (!loading && user && isMarketingDomain()) {
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
          <LogoutProvider>
            <div className="min-h-dvh overflow-x-hidden bg-gray-50 md:h-screen md:overflow-hidden">
              <AppLayoutWithTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isNewProjectDialogOpen={isNewProjectDialogOpen}
                setIsNewProjectDialogOpen={setIsNewProjectDialogOpen}
              >
                {renderActiveView()}
              </AppLayoutWithTabs>
              <Toaster />
            </div>
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
      case "metrics":
        return "Metrics";
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
