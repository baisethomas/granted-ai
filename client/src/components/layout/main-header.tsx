import { Bell, LogOut, Plus, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";

interface MainHeaderProps {
  title?: string;
  subtitle?: string;
  onNewProject?: () => void;
  onNavigateToSettings?: () => void;
}

export function MainHeader({
  title = "Dashboard",
  subtitle = "Welcome to your new project",
  onNewProject,
  onNavigateToSettings,
}: MainHeaderProps) {
  const { user } = useAuth();
  const handleLogout = useLogout();

  const displayName = user?.email ? user.email.split("@")[0] : "User";
  const initial = displayName.charAt(0).toUpperCase();

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Open account menu"
                data-testid="button-account-menu"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </span>
                {user?.email && (
                  <span className="text-xs text-gray-500 font-normal truncate">
                    {user.email}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onNavigateToSettings && (
                <DropdownMenuItem onSelect={onNavigateToSettings}>
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleLogout();
                }}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                data-testid="menu-item-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
