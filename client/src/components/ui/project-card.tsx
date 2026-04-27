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

interface ProjectCardProps {
  project: Project;
  onDelete?: (projectId: string) => void;
  onEdit?: (projectId: string) => void;
  onOpen?: (projectId: string) => void;
}

const statusColors = {
  draft: "bg-yellow-100 text-yellow-800",
  submitted: "bg-green-100 text-green-800",
  awarded: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

const statusLabels = {
  draft: "Draft Review",
  submitted: "Submitted", 
  awarded: "Awarded",
  declined: "Declined",
};

export function ProjectCard({ project, onDelete, onEdit, onOpen }: ProjectCardProps) {
  const formatDate = (date: string | undefined) => {
    if (!date) return "No deadline";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const clickable = Boolean(onOpen);

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
            <Badge 
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[project.status as keyof typeof statusColors] || statusColors.draft
              }`}
            >
              {statusLabels[project.status as keyof typeof statusLabels] || project.status}
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
