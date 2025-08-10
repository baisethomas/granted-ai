import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { 
  Save, 
  Plus, 
  X,
  Info
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  const [organizationForm, setOrganizationForm] = useState({
    organizationName: "",
    organizationType: "501(c)(3) Nonprofit",
    ein: "",
    foundedYear: 2015,
    primaryContact: "",
    email: "",
    mission: "",
    focusAreas: [] as string[],
  });

  const [aiSettings, setAiSettings] = useState({
    defaultTone: "professional",
    lengthPreference: "balanced",
    emphasisAreas: [] as string[],
    aiModel: "gpt-4o",
    fallbackModel: "gpt-3.5-turbo",
    creativity: 30,
    contextUsage: 80,
    autoDetection: true,
  });

  const [accountSettings, setAccountSettings] = useState({
    emailNotifications: true,
    autoSave: true,
    analytics: true,
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save settings",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      ...aiSettings,
      ...accountSettings,
    });
  };

  const handleResetDefaults = () => {
    setAiSettings({
      defaultTone: "professional",
      lengthPreference: "balanced",
      emphasisAreas: ["Impact & Outcomes", "Innovation", "Sustainability", "Community Engagement"],
      aiModel: "gpt-4o",
      fallbackModel: "gpt-3.5-turbo",
      creativity: 30,
      contextUsage: 80,
      autoDetection: true,
    });

    setAccountSettings({
      emailNotifications: true,
      autoSave: true,
      analytics: true,
    });
  };

  const addFocusArea = (area: string) => {
    if (area && !organizationForm.focusAreas.includes(area)) {
      setOrganizationForm({
        ...organizationForm,
        focusAreas: [...organizationForm.focusAreas, area],
      });
    }
  };

  const removeFocusArea = (area: string) => {
    setOrganizationForm({
      ...organizationForm,
      focusAreas: organizationForm.focusAreas.filter(a => a !== area),
    });
  };

  const addEmphasisArea = (area: string) => {
    if (area && !aiSettings.emphasisAreas.includes(area)) {
      setAiSettings({
        ...aiSettings,
        emphasisAreas: [...aiSettings.emphasisAreas, area],
      });
    }
  };

  const removeEmphasisArea = (area: string) => {
    setAiSettings({
      ...aiSettings,
      emphasisAreas: aiSettings.emphasisAreas.filter(a => a !== area),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Settings & Profile</h2>
          <p className="text-slate-600 mb-8">
            Manage your organization information, AI preferences, and account settings.
          </p>

          {/* Organization Profile */}
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">Organization Profile</h3>
              <p className="text-sm text-slate-600 mt-1">
                This information helps the AI better understand your organization
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={organizationForm.organizationName}
                  onChange={(e) => setOrganizationForm({ ...organizationForm, organizationName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgType">Organization Type</Label>
                <Select 
                  value={organizationForm.organizationType} 
                  onValueChange={(value) => setOrganizationForm({ ...organizationForm, organizationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="501(c)(3) Nonprofit">501(c)(3) Nonprofit</SelectItem>
                    <SelectItem value="Educational Institution">Educational Institution</SelectItem>
                    <SelectItem value="Government Agency">Government Agency</SelectItem>
                    <SelectItem value="Research Institution">Research Institution</SelectItem>
                    <SelectItem value="For-Profit Organization">For-Profit Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein">EIN (Tax ID)</Label>
                <Input
                  id="ein"
                  placeholder="XX-XXXXXXX"
                  value={organizationForm.ein}
                  onChange={(e) => setOrganizationForm({ ...organizationForm, ein: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="foundedYear">Founded Year</Label>
                <Input
                  id="foundedYear"
                  type="number"
                  value={organizationForm.foundedYear}
                  onChange={(e) => setOrganizationForm({ ...organizationForm, foundedYear: parseInt(e.target.value) || 2015 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primaryContact">Primary Contact</Label>
                <Input
                  id="primaryContact"
                  placeholder="Jane Smith"
                  value={organizationForm.primaryContact}
                  onChange={(e) => setOrganizationForm({ ...organizationForm, primaryContact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="grants@nonprofit.org"
                  value={organizationForm.email}
                  onChange={(e) => setOrganizationForm({ ...organizationForm, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mission">Mission Statement</Label>
              <Textarea
                id="mission"
                rows={4}
                placeholder="Brief description of your organization's mission..."
                value={organizationForm.mission}
                onChange={(e) => setOrganizationForm({ ...organizationForm, mission: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Focus Areas</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {organizationForm.focusAreas.map((area) => (
                  <Badge key={area} className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-800">
                    {area}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFocusArea(area)}
                      className="ml-1 p-0 h-auto text-primary-600 hover:text-primary-800"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newArea = prompt("Enter focus area:");
                    if (newArea) addFocusArea(newArea);
                  }}
                  className="inline-flex items-center px-3 py-1 text-sm"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Focus Area
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Preferences */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="p-6 border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900">AI Generation Preferences</CardTitle>
          <p className="text-sm text-slate-600 mt-1">Customize how the AI generates grant responses</p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Default Writing Tone</Label>
              <Select value={aiSettings.defaultTone} onValueChange={(value) => 
                setAiSettings({ ...aiSettings, defaultTone: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="data-driven">Data-Driven</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Response Length Preference</Label>
              <Select value={aiSettings.lengthPreference} onValueChange={(value) => 
                setAiSettings({ ...aiSettings, lengthPreference: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Emphasis Areas (Check all that apply)</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "Impact & Outcomes",
                "Innovation", 
                "Collaboration",
                "Sustainability",
                "Cost-Effectiveness",
                "Community Engagement",
                "Research & Evidence",
                "Scalability"
              ].map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={area}
                    checked={aiSettings.emphasisAreas.includes(area)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        addEmphasisArea(area);
                      } else {
                        removeEmphasisArea(area);
                      }
                    }}
                  />
                  <Label htmlFor={area} className="text-sm">{area}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Automatic Question Detection</p>
              <p className="text-sm text-slate-600">
                Automatically identify and parse questions from uploaded grant documents
              </p>
            </div>
            <Switch
              checked={aiSettings.autoDetection}
              onCheckedChange={(checked) => setAiSettings({ ...aiSettings, autoDetection: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* LLM Configuration */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="p-6 border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900">AI Model Configuration</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Choose your preferred AI model and configure API settings
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Primary AI Model</Label>
              <Select value={aiSettings.aiModel} onValueChange={(value) => 
                setAiSettings({ ...aiSettings, aiModel: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">OpenAI GPT-4o</SelectItem>
                  <SelectItem value="gpt-4">OpenAI GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3">Anthropic Claude 3</SelectItem>
                  <SelectItem value="claude-2">Anthropic Claude 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fallback Model</Label>
              <Select value={aiSettings.fallbackModel} onValueChange={(value) => 
                setAiSettings({ ...aiSettings, fallbackModel: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-2">Anthropic Claude 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Info className="text-blue-600 mt-1 mr-3 h-4 w-4" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">API Configuration</p>
                <p className="text-sm text-blue-800">
                  API keys are managed securely in your account settings. The system automatically 
                  switches to fallback models if the primary model is unavailable.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Label className="text-sm font-medium text-slate-700">Model Performance Settings</Label>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Response Creativity</p>
                    <p className="text-xs text-slate-600">Higher values produce more creative responses</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-slate-500">Conservative</span>
                    <div className="w-32">
                      <Slider
                        value={[aiSettings.creativity]}
                        onValueChange={(value) => setAiSettings({ ...aiSettings, creativity: value[0] })}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <span className="text-xs text-slate-500">Creative</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Context Usage</p>
                    <p className="text-xs text-slate-600">How much of your uploaded context to use</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-slate-500">Minimal</span>
                    <div className="w-32">
                      <Slider
                        value={[aiSettings.contextUsage]}
                        onValueChange={(value) => setAiSettings({ ...aiSettings, contextUsage: value[0] })}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <span className="text-xs text-slate-500">Maximum</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="p-6 border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900">Account Settings</CardTitle>
          <p className="text-sm text-slate-600 mt-1">Manage your account preferences and notifications</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Email Notifications</p>
              <p className="text-sm text-slate-600">Receive updates on generation status and deadlines</p>
            </div>
            <Switch
              checked={accountSettings.emailNotifications}
              onCheckedChange={(checked) => setAccountSettings({ ...accountSettings, emailNotifications: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Auto-Save Drafts</p>
              <p className="text-sm text-slate-600">Automatically save changes as you edit responses</p>
            </div>
            <Switch
              checked={accountSettings.autoSave}
              onCheckedChange={(checked) => setAccountSettings({ ...accountSettings, autoSave: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Usage Analytics</p>
              <p className="text-sm text-slate-600">Track your grant writing progress and success metrics</p>
            </div>
            <Switch
              checked={accountSettings.analytics}
              onCheckedChange={(checked) => setAccountSettings({ ...accountSettings, analytics: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <div className="flex items-center justify-end space-x-4 pt-6">
        <Button variant="outline" onClick={handleResetDefaults}>
          Reset to Defaults
        </Button>
        <Button 
          onClick={handleSaveSettings}
          disabled={updateSettingsMutation.isPending}
          className="bg-primary-600 hover:bg-primary-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
