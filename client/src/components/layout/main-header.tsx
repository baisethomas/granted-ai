import { Bell, Building2, LogOut, Plus, Settings as SettingsIcon } from "lucide-react";
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
  onNavigateToOrganization?: () => void;
}

export function MainHeader({
  title = "Dashboard",
  subtitle = "Welcome to your new project",
  onNewProject,
  onNavigateToSettings,
  onNavigateToOrganization,
}: MainHeaderProps) {
  const { user } = useAuth();
  const handleLogout = useLogout();

  const displayName = user?.email ? user.email.split("@")[0] : "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 md:px-6 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 md:text-lg">{title}</h1>
          <p className="hidden text-sm text-gray-500 sm:block">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <button className="hidden text-gray-500 transition-colors hover:text-gray-700 sm:inline-flex">
            <Bell className="w-5 h-5" />
          </button>
          {onNewProject && (
            <Button
              onClick={onNewProject}
              size="sm"
              className="flex items-center"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">New application</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-[#EAF2FE] text-primary text-sm font-semibold hover:bg-[#CDE4FE] transition-colors focus:outline-none focus:ring-[3px] focus:ring-primary/15 focus:ring-offset-0"
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
              {onNavigateToOrganization && (
                <DropdownMenuItem onSelect={onNavigateToOrganization} className="md:hidden">
                  <Building2 className="w-4 h-4 mr-2" />
                  Organization
                </DropdownMenuItem>
              )}
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
