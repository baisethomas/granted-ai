import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MainHeaderProps {
  title?: string;
  subtitle?: string;
  onNewProject?: () => void;
}

export function MainHeader({ 
  title = "Dashboard", 
  subtitle = "Welcome to your new project",
  onNewProject 
}: MainHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 py-4 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="text-gray-500 hover:text-gray-700 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          {onNewProject && (
            <Button 
              onClick={onNewProject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

