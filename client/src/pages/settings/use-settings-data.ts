import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UserSettings } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";

interface OrganizationForm {
  organizationName: string;
  organizationType: string;
  ein: string;
  foundedYear: number;
  primaryContact: string;
  email: string;
  mission: string;
  focusAreas: string[];
}

interface AISettings {
  defaultTone: string;
  lengthPreference: string;
  emphasisAreas: string[];
  aiModel: string;
  fallbackModel: string;
  creativity: number;
  contextUsage: number;
  autoDetection: boolean;
}

interface AccountSettings {
  emailNotifications: boolean;
  autoSave: boolean;
  analytics: boolean;
}

/**
 * Custom hook for managing settings data and state
 */
export function useSettingsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: workspaceKeys.userSettings(),
    queryFn: api.getSettings,
  });

  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>({
    organizationName: "",
    organizationType: "501(c)(3) Nonprofit",
    ein: "",
    foundedYear: 2015,
    primaryContact: "",
    email: "",
    mission: "",
    focusAreas: [],
  });

  const [aiSettings, setAiSettings] = useState<AISettings>({
    defaultTone: "professional",
    lengthPreference: "balanced",
    emphasisAreas: [],
    aiModel: "gpt-4o",
    fallbackModel: "gpt-3.5-turbo",
    creativity: 30,
    contextUsage: 80,
    autoDetection: true,
  });

  const [accountSettings, setAccountSettings] = useState<AccountSettings>({
    emailNotifications: true,
    autoSave: true,
    analytics: true,
  });

  // Load settings when data is available
  useEffect(() => {
    if (settings) {
      setOrganizationForm({
        organizationName: "Nonprofit Excellence Foundation",
        organizationType: "501(c)(3) Nonprofit",
        ein: "",
        foundedYear: 2015,
        primaryContact: "",
        email: "",
        mission: "To strengthen communities through innovative health initiatives and educational programs that address systemic inequalities and empower individuals to thrive.",
        focusAreas: ["Community Health", "Education", "Social Justice"],
      });

      setAiSettings({
        defaultTone: settings.defaultTone || "professional",
        lengthPreference: settings.lengthPreference || "balanced",
        emphasisAreas: settings.emphasisAreas || ["Impact & Outcomes", "Innovation", "Sustainability", "Community Engagement"],
        aiModel: settings.aiModel || "gpt-4o",
        fallbackModel: settings.fallbackModel || "gpt-3.5-turbo",
        creativity: settings.creativity || 30,
        contextUsage: settings.contextUsage || 80,
        autoDetection: settings.autoDetection !== undefined ? settings.autoDetection : true,
      });

      setAccountSettings({
        emailNotifications: settings.emailNotifications !== undefined ? settings.emailNotifications : true,
        autoSave: settings.autoSave !== undefined ? settings.autoSave : true,
        analytics: settings.analytics !== undefined ? settings.analytics : true,
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.userSettings() });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "Could not save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    const combinedSettings = {
      ...organizationForm,
      ...aiSettings,
      ...accountSettings,
    };
    updateSettingsMutation.mutate(combinedSettings);
  };

  return {
    settings,
    isLoading,
    organizationForm,
    setOrganizationForm,
    aiSettings,
    setAiSettings,
    accountSettings,
    setAccountSettings,
    handleSaveSettings,
    isSaving: updateSettingsMutation.isPending,
  };
}
