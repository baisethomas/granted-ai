import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Organization, type OrganizationInput } from "@/lib/api";

interface WorkspaceContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeOrganizationId: string | null;
  isLoading: boolean;
  createOrganization: (input: OrganizationInput) => Promise<Organization>;
  deleteOrganization: (organizationId: string) => Promise<void>;
  setActiveOrganizationId: (organizationId: string) => void;
}

const WORKSPACE_CONTEXT_KEY = "__grantedWorkspaceContext";
const globalWithWorkspaceContext = globalThis as typeof globalThis & {
  [WORKSPACE_CONTEXT_KEY]?: React.Context<WorkspaceContextValue | null>;
};

const WorkspaceContext =
  globalWithWorkspaceContext[WORKSPACE_CONTEXT_KEY] ??
  createContext<WorkspaceContextValue | null>(null);

globalWithWorkspaceContext[WORKSPACE_CONTEXT_KEY] = WorkspaceContext;

const STORAGE_KEY = "granted.activeOrganizationId";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY)
  );

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: api.getOrganizations,
  });

  useEffect(() => {
    if (!organizations.length) return;
    const stillExists = activeOrganizationId
      ? organizations.some((organization) => organization.id === activeOrganizationId)
      : false;
    if (!stillExists) {
      setActiveOrganizationIdState(organizations[0].id);
      window.localStorage.setItem(STORAGE_KEY, organizations[0].id);
    }
  }, [activeOrganizationId, organizations]);

  const createMutation = useMutation({
    mutationFn: api.createOrganization,
    onSuccess: (organization) => {
      queryClient.setQueryData<Organization[]>(["/api/organizations"], (current = []) => {
        const exists = current.some((item) => item.id === organization.id);
        return exists ? current : [...current, organization];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setActiveOrganizationIdState(organization.id);
      window.localStorage.setItem(STORAGE_KEY, organization.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteOrganization,
    onSuccess: (_result, deletedOrganizationId) => {
      const remainingOrganizations = (queryClient.getQueryData<Organization[]>(["/api/organizations"]) ?? [])
        .filter((organization) => organization.id !== deletedOrganizationId);

      queryClient.setQueryData<Organization[]>(["/api/organizations"], remainingOrganizations);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.removeQueries({ queryKey: ["organizations", deletedOrganizationId] });

      if (activeOrganizationId === deletedOrganizationId) {
        const nextOrganizationId = remainingOrganizations[0]?.id ?? null;
        setActiveOrganizationIdState(nextOrganizationId);
        if (nextOrganizationId) {
          window.localStorage.setItem(STORAGE_KEY, nextOrganizationId);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    },
  });

  const setActiveOrganizationId = (organizationId: string) => {
    setActiveOrganizationIdState(organizationId);
    window.localStorage.setItem(STORAGE_KEY, organizationId);
  };

  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === activeOrganizationId) ?? null,
    [activeOrganizationId, organizations]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        organizations,
        activeOrganization,
        activeOrganizationId,
        isLoading,
        createOrganization: (input) => createMutation.mutateAsync(input),
        deleteOrganization: async (organizationId) => {
          await deleteMutation.mutateAsync(organizationId);
        },
        setActiveOrganizationId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
