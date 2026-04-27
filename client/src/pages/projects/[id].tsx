import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { MetricsTab } from "./metrics";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  submitted: "bg-green-100 text-green-800",
  awarded: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => api.getProject(projectId),
    enabled: Boolean(projectId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-600">Project not found.</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const deadline = project.deadline ? new Date(project.deadline) : null;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl">{project.title}</h2>
            <Badge className={statusColors[project.status] ?? statusColors.draft}>
              {project.status}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {project.funder}
            {project.amount ? ` · ${project.amount}` : ""}
            {deadline
              ? ` · Due ${deadline.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit project
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="min-w-max">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3 md:p-6">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Description
                </p>
                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                  {project.description || "No description provided."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Funder"
                  value={project.funder}
                />
                <Field
                  label="Amount"
                  value={project.amount || "—"}
                />
                <Field
                  label="Status"
                  value={project.status}
                />
                <Field
                  label="Deadline"
                  value={
                    deadline
                      ? deadline.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          <Card>
            <CardContent className="p-8 text-center text-slate-600">
              <p>Use the <span className="font-medium">Grant Forms</span> tab to manage questions.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          <Card>
            <CardContent className="p-8 text-center text-slate-600">
              <p>Use the <span className="font-medium">Drafts</span> tab to review generated responses.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-900 mt-1">{value}</p>
    </div>
  );
}
