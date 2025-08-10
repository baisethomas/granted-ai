import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

// Import pages
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Forms from "@/pages/forms";
import Drafts from "@/pages/drafts";
import Settings from "@/pages/settings";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-slate-50">
          <AppLayoutWithTabs activeTab={activeTab} onTabChange={setActiveTab}>
            {renderActiveView()}
          </AppLayoutWithTabs>
          <Toaster />
        </div>
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
