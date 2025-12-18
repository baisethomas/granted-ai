import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  CloudUpload, 
  FileText, 
  Eye, 
  Settings,
  Bell,
  Edit
} from "lucide-react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Upload", icon: CloudUpload },
  { id: "forms", label: "Grant Forms", icon: FileText },
  { id: "drafts", label: "Drafts", icon: Eye },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Edit className="text-white text-sm" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Granted</h1>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-primary-600 bg-primary-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Button variant="ghost" size="sm" className="p-2">
              <Bell className="h-5 w-5 text-slate-400" />
            </Button>
            <Badge className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-0 p-0"></Badge>
          </div>
          <div className="w-8 h-8 bg-slate-300 rounded-full"></div>
        </div>
      </div>
    </nav>
  );
}
