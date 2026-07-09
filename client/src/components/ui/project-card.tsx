import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, ExternalLink } from "lucide-react";
import { type Project } from "@/lib/api";
import { formatCurrencyDisplay } from "@/lib/currency";

export interface ProjectQuestionCounts {
  total: number;
  answered: number;
  loading: boolean;
}

interface ProjectCardProps {
  project: Project;
  questionCounts?: ProjectQuestionCounts;
  onDelete?: (projectId: string) => void;
  onEdit?: (projectId: string) => void;
  onOpen?: (projectId: string) => void;
}

// Terminal lifecycle states are explicit user actions (Edit dialog / future
// submit flow) and always win once set — they mean more than draft progress.
const lifecycleStatus: Record<string, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-green-100 text-green-800" },
  awarded: { label: "Awarded", className: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Declined", className: "bg-red-100 text-red-800" },
};

function getDisplayStatus(project: Project, counts?: ProjectQuestionCounts) {
  const terminal = lifecycleStatus[project.status];
  if (terminal) return terminal;

  if (!counts || counts.loading) {
    return { label: "Setting up", className: "bg-slate-100 text-slate-600" };
  }
  if (counts.total === 0) {
    return { label: "Setting up", className: "bg-slate-100 text-slate-600" };
  }
  if (counts.answered >= counts.total) {
    return { label: "Ready to review", className: "bg-emerald-100 text-emerald-800" };
  }
  return {
    label: `Drafting ${counts.answered}/${counts.total}`,
    className: "bg-yellow-100 text-yellow-800",
  };
}

export function ProjectCard({ project, questionCounts, onDelete, onEdit, onOpen }: ProjectCardProps) {
  const formatDate = (date: string | undefined) => {
    if (!date) return "No deadline";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const clickable = Boolean(onOpen);
  const displayStatus = getDisplayStatus(project, questionCounts);
  const showProgress =
    !lifecycleStatus[project.status] &&
    questionCounts &&
    !questionCounts.loading &&
    questionCounts.total > 0 &&
    questionCounts.answered < questionCounts.total;

  return (
    <Card
      className={`transition-colors ${clickable ? "hover:bg-slate-50 cursor-pointer" : "hover:bg-slate-50"}`}
      onClick={clickable ? () => onOpen?.(project.id) : undefined}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <i className="fas fa-file-alt text-blue-600"></i>
            </div>
            <div className="min-w-0">
              <h4 className="truncate font-medium text-slate-900">{project.title}</h4>
              <p className="truncate text-sm text-slate-600">
                {project.funder}
                {(() => {
                  const amount = formatCurrencyDisplay(project.amount);
                  return amount ? ` • ${amount}` : "";
                })()}
              </p>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2 sm:gap-4"
            onClick={e => e.stopPropagation()}
          >
            {showProgress && (
              <div
                className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:block"
                role="progressbar"
                aria-valuenow={questionCounts!.answered}
                aria-valuemin={0}
                aria-valuemax={questionCounts!.total}
                aria-label={`${questionCounts!.answered} of ${questionCounts!.total} questions drafted`}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(questionCounts!.answered / questionCounts!.total) * 100}%` }}
                />
              </div>
            )}
            <Badge
              className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ${displayStatus.className}`}
            >
              {displayStatus.label}
            </Badge>
            <span className="text-sm text-slate-500">
              Due: {formatDate(project.deadline)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onOpen && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onOpen?.(project.id)}
                      className="cursor-pointer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => onEdit?.(project.id)}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(project.id)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
