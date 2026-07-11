import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, type UserSettings } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Check, Loader2, LogOut } from "lucide-react";
import UsageDashboard from "@/components/UsageDashboard";
import { useLogout } from "@/hooks/useLogout";

const EMPHASIS_OPTIONS = [
  "Impact & Outcomes",
  "Innovation",
  "Collaboration",
  "Sustainability",
  "Cost-Effectiveness",
  "Community Engagement",
  "Research & Evidence",
  "Scalability",
];

const DEFAULT_AI_SETTINGS = {
  defaultTone: "professional",
  lengthPreference: "balanced",
  emphasisAreas: ["Impact & Outcomes", "Innovation", "Sustainability", "Community Engagement"],
  aiModel: "gpt-4o",
  fallbackModel: "gpt-3.5-turbo",
  creativity: 30,
  contextUsage: 80,
  autoDetection: true,
};

const DEFAULT_ACCOUNT_SETTINGS = {
  emailNotifications: true,
  autoSave: true,
  analytics: true,
};

// One consistent row: label + description on the left, control on the right.
function SettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
          {title}
        </Label>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Variant for wide controls (sliders, chip groups) that need the full row width.
function SettingsRowStacked({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-6 first:pt-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handleLogout = useLogout();
  const { activeOrganizationId } = useWorkspace();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: workspaceKeys.userSettings(),
    queryFn: api.getSettings,
  });

  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [accountSettings, setAccountSettings] = useState(DEFAULT_ACCOUNT_SETTINGS);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Snapshot of the last persisted payload. null until server settings hydrate,
  // which also gates auto-save so we never fire a save for the initial load.
  const savedSnapshot = useRef<string | null>(null);
  const savedBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    const nextAi = {
      defaultTone: settings.defaultTone || DEFAULT_AI_SETTINGS.defaultTone,
      lengthPreference: settings.lengthPreference || DEFAULT_AI_SETTINGS.lengthPreference,
      emphasisAreas: settings.emphasisAreas || DEFAULT_AI_SETTINGS.emphasisAreas,
      aiModel: settings.aiModel || DEFAULT_AI_SETTINGS.aiModel,
      fallbackModel: settings.fallbackModel || DEFAULT_AI_SETTINGS.fallbackModel,
      creativity: settings.creativity || DEFAULT_AI_SETTINGS.creativity,
      contextUsage: settings.contextUsage || DEFAULT_AI_SETTINGS.contextUsage,
      autoDetection: settings.autoDetection !== undefined ? settings.autoDetection : DEFAULT_AI_SETTINGS.autoDetection,
    };
    const nextAccount = {
      emailNotifications:
        settings.emailNotifications !== undefined
          ? settings.emailNotifications
          : DEFAULT_ACCOUNT_SETTINGS.emailNotifications,
      autoSave: settings.autoSave !== undefined ? settings.autoSave : DEFAULT_ACCOUNT_SETTINGS.autoSave,
      analytics: settings.analytics !== undefined ? settings.analytics : DEFAULT_ACCOUNT_SETTINGS.analytics,
    };
    setAiSettings(nextAi);
    setAccountSettings(nextAccount);
    savedSnapshot.current = JSON.stringify({ ...nextAi, ...nextAccount });
  }, [settings]);

  // Serialized write loop: at most one PUT in flight, and edits made while a
  // write is pending coalesce into pendingJson (latest wins) to be sent when
  // the current write settles — so an older response can never land after,
  // and silently overwrite, a newer one. Uses api.updateSettings directly
  // (not useMutation) so a flush started during unmount still completes.
  const pendingJson = useRef<string | null>(null);
  const writing = useRef(false);

  const flush = async () => {
    if (writing.current) return; // the active loop below picks up pendingJson
    writing.current = true;
    try {
      while (pendingJson.current && pendingJson.current !== savedSnapshot.current) {
        const json = pendingJson.current;
        setSaveState("saving");
        try {
          await api.updateSettings(JSON.parse(json));
          savedSnapshot.current = json;
          if (pendingJson.current === json) pendingJson.current = null;
          queryClient.invalidateQueries({ queryKey: workspaceKeys.userSettings() });
          setSaveState("saved");
          if (savedBadgeTimer.current) clearTimeout(savedBadgeTimer.current);
          savedBadgeTimer.current = setTimeout(() => setSaveState("idle"), 2000);
        } catch {
          // Drop the pending payload (no automatic retry loop) but leave the
          // snapshot stale, so the next edit re-sends the full current state.
          if (pendingJson.current === json) pendingJson.current = null;
          setSaveState("idle");
          toast({
            title: "Couldn't save your settings",
            description: "Your last change wasn't saved. Adjust any setting to retry.",
            variant: "destructive",
          });
          break;
        }
      }
    } finally {
      writing.current = false;
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Auto-save: whenever settings drift from the last persisted snapshot,
  // debounce briefly (absorbs slider drags) and persist.
  useEffect(() => {
    if (!hydrated.current) return;
    const json = JSON.stringify({ ...aiSettings, ...accountSettings });
    if (json === savedSnapshot.current) return;
    pendingJson.current = json;
    const timer = setTimeout(() => void flushRef.current(), 700);
    return () => clearTimeout(timer);
  }, [aiSettings, accountSettings]);

  // An edit still inside the debounce window must survive leaving the page:
  // flush immediately on unmount (in-app navigation) and best-effort on
  // pagehide (tab close — the browser may still cancel the request).
  useEffect(() => {
    const onPageHide = () => void flushRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void flushRef.current();
      if (savedBadgeTimer.current) clearTimeout(savedBadgeTimer.current);
    };
  }, []);

  const toggleEmphasisArea = (area: string) => {
    setAiSettings((prev) => ({
      ...prev,
      emphasisAreas: prev.emphasisAreas.includes(area)
        ? prev.emphasisAreas.filter((a) => a !== area)
        : [...prev.emphasisAreas, area],
    }));
  };

  const handleResetDefaults = () => {
    setAiSettings((prev) => ({
      ...DEFAULT_AI_SETTINGS,
      // Reset covers drafting preferences only — leave whatever model config
      // the account already has untouched.
      aiModel: prev.aiModel,
      fallbackModel: prev.fallbackModel,
    }));
  };

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-9 w-72 rounded-lg bg-slate-100" />
        <div className="mt-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Tabs defaultValue="drafting">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 md:px-6">
            <div className="overflow-x-auto">
              <TabsList className="min-w-max">
                <TabsTrigger value="drafting">Drafting</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="usage">Usage &amp; billing</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex h-5 shrink-0 items-center text-xs text-slate-400" aria-live="polite">
              {saveState === "saving" && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          </div>

          <div className="px-4 pb-6 md:px-6">
            <TabsContent value="drafting" className="mt-0">
              <SettingsSection
                title="Voice"
                description="The tone and priorities Granted uses when drafting your responses."
              >
                <SettingsRow title="Writing tone" description="The default voice for generated drafts.">
                  <Select
                    value={aiSettings.defaultTone}
                    onValueChange={(value) => setAiSettings({ ...aiSettings, defaultTone: value })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="data-driven">Data-driven</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow title="Response length" description="How detailed drafts should be by default.">
                  <Select
                    value={aiSettings.lengthPreference}
                    onValueChange={(value) => setAiSettings({ ...aiSettings, lengthPreference: value })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRowStacked
                  title="Emphasis areas"
                  description="Themes to highlight when your source material supports them."
                >
                  <div className="flex flex-wrap gap-2">
                    {EMPHASIS_OPTIONS.map((area) => {
                      const selected = aiSettings.emphasisAreas.includes(area);
                      return (
                        <button
                          key={area}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleEmphasisArea(area)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? "border-primary bg-[#EAF2FE] font-medium text-primary"
                              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                          }`}
                        >
                          {area}
                        </button>
                      );
                    })}
                  </div>
                </SettingsRowStacked>
              </SettingsSection>

              <div className="border-t border-slate-200" />

              <SettingsSection
                title="Drafting behavior"
                description="How Granted balances your source material against fresh phrasing."
              >
                <SettingsRowStacked
                  title="Response creativity"
                  description="Conservative sticks closely to your documents; creative allows more original phrasing."
                >
                  <div className="flex items-center gap-4">
                    <span className="w-24 shrink-0 text-xs text-slate-500">Conservative</span>
                    <Slider
                      value={[aiSettings.creativity]}
                      onValueChange={(value) => setAiSettings({ ...aiSettings, creativity: value[0] })}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-24 shrink-0 text-right text-xs text-slate-500">Creative</span>
                  </div>
                </SettingsRowStacked>
                <SettingsRowStacked
                  title="Context usage"
                  description="How much of your uploaded material to draw on for each draft."
                >
                  <div className="flex items-center gap-4">
                    <span className="w-24 shrink-0 text-xs text-slate-500">Minimal</span>
                    <Slider
                      value={[aiSettings.contextUsage]}
                      onValueChange={(value) => setAiSettings({ ...aiSettings, contextUsage: value[0] })}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-24 shrink-0 text-right text-xs text-slate-500">Maximum</span>
                  </div>
                </SettingsRowStacked>
                <SettingsRow
                  title="Automatic question detection"
                  description="Identify and parse questions from uploaded grant documents."
                >
                  <Switch
                    checked={aiSettings.autoDetection}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, autoDetection: checked })}
                  />
                </SettingsRow>
              </SettingsSection>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-sm text-slate-400 underline-offset-4 transition-colors hover:text-slate-600 hover:underline"
              >
                Reset drafting preferences to defaults
              </button>
            </TabsContent>

            <TabsContent value="general" className="mt-0">
              <SettingsSection title="Workspace" description="Notifications and day-to-day behavior.">
                <SettingsRow
                  title="Email notifications"
                  description="Updates on generation status and deadlines."
                >
                  <Switch
                    checked={accountSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setAccountSettings({ ...accountSettings, emailNotifications: checked })
                    }
                  />
                </SettingsRow>
                <SettingsRow title="Auto-save drafts" description="Save changes as you edit responses.">
                  <Switch
                    checked={accountSettings.autoSave}
                    onCheckedChange={(checked) => setAccountSettings({ ...accountSettings, autoSave: checked })}
                  />
                </SettingsRow>
                <SettingsRow
                  title="Usage analytics"
                  description="Track your grant writing progress and success metrics."
                >
                  <Switch
                    checked={accountSettings.analytics}
                    onCheckedChange={(checked) => setAccountSettings({ ...accountSettings, analytics: checked })}
                  />
                </SettingsRow>
              </SettingsSection>

              <div className="border-t border-slate-200" />

              <SettingsSection title="Session">
                <SettingsRow title="Sign out" description="End your session on this device.">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    data-testid="button-logout-settings"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </SettingsRow>
              </SettingsSection>
            </TabsContent>

            <TabsContent value="usage" className="mt-0 pt-6">
              <UsageDashboard organizationId={activeOrganizationId} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
