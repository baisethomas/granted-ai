import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Organization, type OrganizationInput } from "@/lib/api";

interface WorkspaceContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeOrganizationId: string | null;
  isLoading: boolean;
  createOrganization: (input: OrganizationInput) => Promise<Organization>;
  setActiveOrganizationId: (organizationId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setActiveOrganizationIdState(organization.id);
      window.localStorage.setItem(STORAGE_KEY, organization.id);
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
        activeOrganizationId: activeOrganization?.id ?? null,
        isLoading,
        createOrganization: (input) => createMutation.mutateAsync(input),
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

