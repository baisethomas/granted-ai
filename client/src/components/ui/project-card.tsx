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
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { type Project } from "@/lib/api";

interface ProjectCardProps {
  project: Project;
  onDelete?: (projectId: string) => void;
  onEdit?: (projectId: string) => void;
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

export function ProjectCard({ project, onDelete, onEdit }: ProjectCardProps) {
  const formatDate = (date: string | undefined) => {
    if (!date) return "No deadline";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <Card className="hover:bg-slate-50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-file-alt text-blue-600"></i>
            </div>
            <div>
              <h4 className="font-medium text-slate-900">{project.title}</h4>
              <p className="text-sm text-slate-600">
                {project.funder} {project.amount && `• ${project.amount}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
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
