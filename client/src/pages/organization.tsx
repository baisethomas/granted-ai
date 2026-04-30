import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Info, Plus, RotateCcw, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type OrganizationProfileSuggestion } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function Organization() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganization, activeOrganizationId, isLoading } = useWorkspace();

  const { data: profileSuggestions = [] } = useQuery<OrganizationProfileSuggestion[]>({
    queryKey: ["organizations", activeOrganizationId, "profile-suggestions"],
    queryFn: () =>
      activeOrganizationId
        ? api.getOrganizationProfileSuggestions(activeOrganizationId)
        : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  const pendingProfileSuggestions = profileSuggestions.filter(
    (suggestion) => suggestion.status === "pending",
  );
  const dismissedProfileSuggestions = profileSuggestions.filter(
    (suggestion) => suggestion.status === "rejected" || suggestion.status === "dismissed",
  );
  const acceptedProfileSuggestions = profileSuggestions.filter(
    (suggestion) => suggestion.status === "accepted",
  );

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

  useEffect(() => {
    if (activeOrganization) {
      setOrganizationForm({
        organizationName: activeOrganization.name || "",
        organizationType: activeOrganization.organizationType || "501(c)(3) Nonprofit",
        ein: activeOrganization.ein || "",
        foundedYear: activeOrganization.foundedYear || 2015,
        primaryContact: activeOrganization.primaryContact || "",
        email: activeOrganization.contactEmail || "",
        mission: activeOrganization.mission || "",
        focusAreas: activeOrganization.focusAreas || [],
      });
    }
  }, [activeOrganization]);

  const updateOrganizationMutation = useMutation({
    mutationFn: () => {
      if (!activeOrganizationId) throw new Error("No active workspace selected");
      return api.updateOrganization(activeOrganizationId, {
        name: organizationForm.organizationName,
        organizationType: organizationForm.organizationType,
        ein: organizationForm.ein || null,
        foundedYear: organizationForm.foundedYear || null,
        primaryContact: organizationForm.primaryContact || null,
        contactEmail: organizationForm.email || null,
        mission: organizationForm.mission || null,
        focusAreas: organizationForm.focusAreas,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organization saved",
        description: "The active workspace profile has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save organization",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const applySuggestionToForm = (suggestion: OrganizationProfileSuggestion) => {
    setOrganizationForm((current) => {
      switch (suggestion.field) {
        case "name":
          return { ...current, organizationName: suggestion.suggestedValue };
        case "organizationType":
          return { ...current, organizationType: suggestion.suggestedValue };
        case "ein":
          return { ...current, ein: suggestion.suggestedValue };
        case "foundedYear": {
          const foundedYear = Number.parseInt(suggestion.suggestedValue, 10);
          return Number.isFinite(foundedYear) ? { ...current, foundedYear } : current;
        }
        case "primaryContact":
          return { ...current, primaryContact: suggestion.suggestedValue };
        case "contactEmail":
          return { ...current, email: suggestion.suggestedValue };
        case "mission":
          return { ...current, mission: suggestion.suggestedValue };
        case "focusAreas":
          return {
            ...current,
            focusAreas: suggestion.suggestedValue
              .split(",")
              .map((area) => area.trim())
              .filter(Boolean),
          };
        default:
          return current;
      }
    });
  };

  const reviewProfileSuggestionMutation = useMutation({
    mutationFn: ({
      suggestionId,
      status,
    }: {
      suggestionId: string;
      status: "pending" | "accepted" | "rejected" | "dismissed";
    }) => {
      if (!activeOrganizationId) throw new Error("No active workspace selected");
      return api.reviewOrganizationProfileSuggestion(activeOrganizationId, suggestionId, status);
    },
    onSuccess: (result, variables) => {
      const reviewedSuggestion = result.suggestion;
      if (variables.status === "accepted" && reviewedSuggestion) {
        applySuggestionToForm(reviewedSuggestion);
      }
      if (result.organization) {
        queryClient.setQueryData<any[]>(["/api/organizations"], (current = []) =>
          current.map((organization) =>
            organization.id === result.organization?.id ? result.organization : organization,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({
          queryKey: ["organizations", activeOrganizationId, "profile-suggestions"],
        });
      }
      toast({
        title:
          variables.status === "accepted"
            ? "Profile updated"
            : variables.status === "pending"
              ? "Suggestion restored"
              : "Suggestion dismissed",
        description:
          variables.status === "accepted"
            ? "The suggestion has been added to this workspace profile."
            : variables.status === "pending"
              ? "The suggestion is back in the review queue."
              : "The suggestion moved to dismissed suggestions.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to review suggestion",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

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
      focusAreas: organizationForm.focusAreas.filter((item) => item !== area),
    });
  };

  const getSuggestionLabel = (field: string) => {
    switch (field) {
      case "name":
        return "Organization Name";
      case "organizationType":
        return "Organization Type";
      case "ein":
        return "EIN";
      case "foundedYear":
        return "Founded Year";
      case "primaryContact":
        return "Primary Contact";
      case "contactEmail":
        return "Contact Email";
      case "mission":
        return "Mission Statement";
      case "focusAreas":
        return "Focus Areas";
      default:
        return field;
    }
  };

  const renderSuggestionCard = (
    suggestion: OrganizationProfileSuggestion,
    actions: ReactNode,
  ) => (
    <div key={suggestion.id} className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {getSuggestionLabel(suggestion.field)}
            </p>
            {typeof suggestion.confidence === "number" && (
              <Badge variant="outline" className="text-[11px]">
                {suggestion.confidence}% confidence
              </Badge>
            )}
          </div>
          <p className="mt-1 break-words text-sm text-slate-900">{suggestion.suggestedValue}</p>
          {suggestion.sourceQuote && (
            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{suggestion.sourceQuote}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );

  const renderReviewActions = (suggestion: OrganizationProfileSuggestion) => (
    <>
      {suggestion.status !== "accepted" && (
        <button
          type="button"
          className="inline-flex h-9 min-w-24 items-center justify-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
          disabled={reviewProfileSuggestionMutation.isPending}
          data-testid={`button-accept-suggestion-${suggestion.id}`}
          onClick={() =>
            reviewProfileSuggestionMutation.mutate({
              suggestionId: suggestion.id,
              status: "accepted",
            })
          }
        >
          <Check className="mr-1 h-3 w-3" />
          Accept
        </button>
      )}
      {suggestion.status === "pending" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={reviewProfileSuggestionMutation.isPending}
          onClick={() =>
            reviewProfileSuggestionMutation.mutate({
              suggestionId: suggestion.id,
              status: "rejected",
            })
          }
        >
          <X className="mr-1 h-3 w-3" />
          Dismiss
        </Button>
      ) : suggestion.status !== "accepted" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={reviewProfileSuggestionMutation.isPending}
          onClick={() =>
            reviewProfileSuggestionMutation.mutate({
              suggestionId: suggestion.id,
              status: "pending",
            })
          }
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Restore
        </Button>
      ) : (
        <Badge className="bg-emerald-100 text-emerald-800">Added</Badge>
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-md bg-slate-200" />
        <div className="h-96 animate-pulse rounded-md bg-slate-200" />
      </div>
    );
  }

  if (!activeOrganizationId) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">No organization selected</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select or create a client workspace from the sidebar to manage organization details.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-200 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Organization Profile
          </CardTitle>
          <p className="text-sm text-slate-600">
            Details here are scoped to the selected workspace and used as context for drafts.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 p-4 md:p-6">
          {profileSuggestions.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-amber-950">
                    Review organization suggestions
                  </h4>
                  <p className="text-sm text-amber-900">
                    Confirm suggestions from uploaded organization documents before they are added to
                    this profile.
                  </p>
                </div>
                <div className="hidden shrink-0 gap-2 text-xs text-amber-900 md:flex">
                  <span>{pendingProfileSuggestions.length} pending</span>
                  <span>{dismissedProfileSuggestions.length} dismissed</span>
                </div>
              </div>
              {pendingProfileSuggestions.length > 0 ? (
                <div className="space-y-3">
                  {pendingProfileSuggestions.map((suggestion) =>
                    renderSuggestionCard(
                      suggestion,
                      renderReviewActions(suggestion),
                    ),
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-white p-3 text-sm text-amber-900">
                  No suggestions are waiting for review.
                </div>
              )}

              {dismissedProfileSuggestions.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div>
                    <h5 className="text-sm font-semibold text-amber-950">Dismissed suggestions</h5>
                    <p className="text-sm text-amber-900">
                      Restore a dismissed suggestion to review it again.
                    </p>
                  </div>
                  {dismissedProfileSuggestions.map((suggestion) =>
                    renderSuggestionCard(
                      suggestion,
                      renderReviewActions(suggestion),
                    ),
                  )}
                </div>
              )}

              {acceptedProfileSuggestions.length > 0 && (
                <div className="mt-4">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-amber-950">
                      Accepted suggestions ({acceptedProfileSuggestions.length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {acceptedProfileSuggestions.map((suggestion) =>
                        renderSuggestionCard(
                          suggestion,
                          renderReviewActions(suggestion),
                        ),
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={organizationForm.organizationName}
                onChange={(event) =>
                  setOrganizationForm({
                    ...organizationForm,
                    organizationName: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgType">Organization Type</Label>
              <Select
                value={organizationForm.organizationType}
                onValueChange={(value) =>
                  setOrganizationForm({ ...organizationForm, organizationType: value })
                }
              >
                <SelectTrigger id="orgType">
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
                onChange={(event) =>
                  setOrganizationForm({ ...organizationForm, ein: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="foundedYear">Founded Year</Label>
              <Input
                id="foundedYear"
                type="number"
                value={organizationForm.foundedYear}
                onChange={(event) =>
                  setOrganizationForm({
                    ...organizationForm,
                    foundedYear: parseInt(event.target.value) || 2015,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryContact">Primary Contact</Label>
              <Input
                id="primaryContact"
                placeholder="Jane Smith"
                value={organizationForm.primaryContact}
                onChange={(event) =>
                  setOrganizationForm({
                    ...organizationForm,
                    primaryContact: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="grants@nonprofit.org"
                value={organizationForm.email}
                onChange={(event) =>
                  setOrganizationForm({ ...organizationForm, email: event.target.value })
                }
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
              onChange={(event) =>
                setOrganizationForm({ ...organizationForm, mission: event.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {organizationForm.focusAreas.map((area) => (
                <Badge
                  key={area}
                  className="inline-flex items-center bg-primary-100 px-3 py-1 text-primary-800"
                >
                  {area}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFocusArea(area)}
                    className="ml-1 h-auto p-0 text-primary-600 hover:text-primary-800"
                    aria-label={`Remove ${area}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              <Button
                type="button"
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => updateOrganizationMutation.mutate()}
          disabled={updateOrganizationMutation.isPending || !organizationForm.organizationName.trim()}
          className="w-full bg-[var(--brand-a)] hover:bg-[color-mix(in_srgb,var(--brand-a)_85%,black)] sm:w-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateOrganizationMutation.isPending ? "Saving..." : "Save Organization"}
        </Button>
      </div>
    </div>
  );
}
