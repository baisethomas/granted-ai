import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { ProjectCard } from "@/components/ui/project-card";
import { api } from "@/lib/api";
import { 
  FolderOpen, 
  TrendingUp, 
  DollarSign, 
  Clock,
  Plus,
  Check,
  Upload,
  Send
} from "lucide-react";

export default function Dashboard() {
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  if (projectsLoading || statsLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Nonprofit Excellence Foundation
              </h2>
              <p className="text-slate-600 mt-1">
                Welcome back! Here's your grant writing progress.
              </p>
            </div>
            <Button className="bg-primary-600 hover:bg-primary-700">
              <Plus className="mr-2 h-4 w-4" />
              New Grant Application
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatsCard
              title="Active Projects"
              value={stats?.activeProjects || 0}
              icon={<FolderOpen className="text-blue-600 h-5 w-5" />}
              iconBgColor="bg-blue-100"
            />
            <StatsCard
              title="Success Rate"
              value={stats?.successRate || "0%"}
              icon={<TrendingUp className="text-green-600 h-5 w-5" />}
              iconBgColor="bg-green-100"
            />
            <StatsCard
              title="Total Awarded"
              value={stats?.totalAwarded || "$0"}
              icon={<DollarSign className="text-emerald-600 h-5 w-5" />}
              iconBgColor="bg-emerald-100"
            />
            <StatsCard
              title="Due This Week"
              value={stats?.dueThisWeek || 0}
              icon={<Clock className="text-orange-600 h-5 w-5" />}
              iconBgColor="bg-orange-100"
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Projects */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="p-6 border-b border-slate-200">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Current Projects
          </CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Track your ongoing grant applications
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No projects yet</h3>
              <p className="text-slate-600 mb-4">Create your first grant application to get started.</p>
              <Button className="bg-primary-600 hover:bg-primary-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project: any) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border border-slate-200">
          <CardHeader className="p-6 border-b border-slate-200">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {projects.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No recent activity</p>
              ) : (
                <>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="text-green-600 h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-900">Project created successfully</p>
                      <p className="text-xs text-slate-500 mt-1">Just now</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-200">
          <CardHeader className="p-6 border-b border-slate-200">
            <CardTitle className="text-lg font-semibold text-slate-900">
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {projects.filter((p: any) => p.deadline).length === 0 ? (
                <p className="text-slate-500 text-center py-8">No upcoming deadlines</p>
              ) : (
                projects
                  .filter((p: any) => p.deadline)
                  .map((project: any) => (
                    <div key={project.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{project.title}</p>
                        <p className="text-sm text-slate-600">{project.funder}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600">
                          {new Date(project.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
