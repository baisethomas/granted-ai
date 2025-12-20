import { 
  LayoutDashboard, 
  CloudUpload, 
  FileText, 
  Eye, 
  Settings,
  BookOpen,
  Video,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const mainNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Upload", icon: CloudUpload },
  { id: "forms", label: "Grant Forms", icon: FileText },
  { id: "drafts", label: "Drafts", icon: Eye },
  { id: "settings", label: "Settings", icon: Settings },
];

const resourceNavItems = [
  { id: "docs", label: "Documentation", icon: BookOpen, href: "#" },
  { id: "tutorials", label: "Tutorials", icon: Video, href: "#" },
  { id: "support", label: "Support", icon: HelpCircle, href: "#" },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user } = useAuth();
  
  const getUserDisplayName = () => {
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  const getUserEmail = () => {
    return user?.email || "";
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-100">
        <a href="#" className="text-2xl font-bold text-indigo-600">Granted</a>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {/* Main Navigation */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Main</p>
          <ul className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "text-indigo-600 bg-indigo-50"
                        : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        
        {/* Resources Navigation - Hidden until resources are available */}
        {/* <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Resources</p>
          <ul className="space-y-1">
            {resourceNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div> */}
      </nav>
      
      {/* User Profile Section */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-indigo-600 text-xs font-semibold">
              {getUserDisplayName().charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{getUserDisplayName()}</p>
            <p className="text-xs text-gray-500 truncate">{getUserEmail()}</p>
          </div>
          <button 
            onClick={() => onTabChange("settings")}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

