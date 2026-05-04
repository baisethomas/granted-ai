import { 
  LayoutDashboard, 
  CloudUpload, 
  FileText, 
  Eye, 
  Settings,
  BookOpen,
  Video,
  HelpCircle,
  LogOut,
  BarChart3,
  Plus,
  Building2,
  Check,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type OrganizationProfileSuggestion } from "@/lib/api";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const mainNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "upload", label: "Upload", icon: CloudUpload },
  { id: "forms", label: "Grant Forms", icon: FileText },
  { id: "drafts", label: "Drafts", icon: Eye },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const resourceNavItems = [
  { id: "docs", label: "Documentation", icon: BookOpen, href: "#" },
  { id: "tutorials", label: "Tutorials", icon: Video, href: "#" },
  { id: "support", label: "Support", icon: HelpCircle, href: "#" },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user } = useAuth();
  const handleLogout = useLogout();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const {
    organizations,
    activeOrganization,
    activeOrganizationId,
    setActiveOrganizationId,
    createOrganization,
    deleteOrganization,
  } = useWorkspace();

  const canDeleteActiveWorkspace = !!activeOrganizationId
    && activeOrganizationId !== user?.id
    && organizations.length > 1;

  const { data: profileSuggestions = [] } = useQuery<OrganizationProfileSuggestion[]>({
    queryKey: workspaceKeys.profileSuggestions(activeOrganizationId),
    queryFn: () =>
      activeOrganizationId
        ? api.getOrganizationProfileSuggestions(activeOrganizationId)
        : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  const pendingProfileSuggestionCount = profileSuggestions.filter(
    (suggestion) => suggestion.status === "pending",
  ).length;

  const getUserDisplayName = () => {
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  const getUserEmail = () => {
    return user?.email || "";
  };

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) {
      setWorkspaceError("Enter a client organization name.");
      return;
    }

    try {
      setIsCreatingWorkspace(true);
      setWorkspaceError(null);
      await createOrganization({ name });
      setWorkspaceName("");
      setIsCreateWorkspaceOpen(false);
    } catch (error: any) {
      setWorkspaceError(error?.message || "Could not create workspace.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeOrganizationId) return;

    try {
      setIsDeletingWorkspace(true);
      setDeleteWorkspaceError(null);
      await deleteOrganization(activeOrganizationId);
      setIsDeleteWorkspaceOpen(false);
    } catch (error: any) {
      setDeleteWorkspaceError(error?.message || "Could not delete workspace.");
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-100">
        <a href="/" className="inline-flex items-center">
          <img src="/logo.png" alt="Granted AI" className="h-14 w-auto" />
        </a>
        <div className="mt-4">
          <Select
            value={activeOrganizationId ?? undefined}
            onValueChange={(value) => setActiveOrganizationId(value)}
          >
            <SelectTrigger className="h-9 w-full text-left">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full justify-start text-xs"
            onClick={() => {
              setWorkspaceError(null);
              setIsCreateWorkspaceOpen(true);
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Create client workspace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-8 w-full justify-start text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={!canDeleteActiveWorkspace}
            onClick={() => {
              setDeleteWorkspaceError(null);
              setIsDeleteWorkspaceOpen(true);
            }}
            title={
              activeOrganizationId === user?.id
                ? "The default workspace cannot be deleted."
                : organizations.length <= 1
                  ? "Create another workspace before deleting this one."
                  : "Delete selected workspace"
            }
            data-testid="button-delete-workspace"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete selected workspace
          </Button>
        </div>
      </div>

      <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
        <DialogContent>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create client workspace</DialogTitle>
              <DialogDescription>
                Add a separate workspace for a client, subsidiary, or applicant organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Organization name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                onChange={(event) => {
                  setWorkspaceName(event.target.value);
                  if (workspaceError) setWorkspaceError(null);
                }}
                placeholder="Acme Community Foundation"
                autoFocus
              />
              {workspaceError && (
                <p className="text-sm text-red-600">{workspaceError}</p>
              )}
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsCreateWorkspaceOpen(false)}
                disabled={isCreatingWorkspace}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingWorkspace || !workspaceName.trim()}
                className="w-full sm:w-auto"
                data-testid="button-save-workspace"
              >
                {!isCreatingWorkspace && <Check className="h-4 w-4" />}
                {isCreatingWorkspace ? "Saving..." : "Save workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteWorkspaceOpen} onOpenChange={setIsDeleteWorkspaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {activeOrganization?.name || "this workspace"} and its projects,
              documents, profile suggestions, and billing usage history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteWorkspaceError && (
            <p className="text-sm text-red-600">{deleteWorkspaceError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWorkspace}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isDeletingWorkspace}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteWorkspace();
              }}
              data-testid="button-confirm-delete-workspace"
            >
              {isDeletingWorkspace ? "Deleting..." : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    {item.id === "organization" && pendingProfileSuggestionCount > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {pendingProfileSuggestionCount}
                      </span>
                    )}
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
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-600 transition-colors ml-2"
            title="Log out"
            aria-label="Log out"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
