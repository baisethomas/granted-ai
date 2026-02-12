import { Badge } from "@/components/ui/badge";
import { Check, Edit, Clock, CheckCircle2 } from "lucide-react";

interface DraftStatusBadgeProps {
  status: string;
  type?: 'question' | 'project';
}

export function DraftStatusBadge({ status, type = 'question' }: DraftStatusBadgeProps) {
  if (type === 'project') {
    return (
      <Badge className={getProjectStatusColor(status)}>
        {getProjectStatusIcon(status)}
        {getProjectStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge className={getStatusColor(status)}>
      {getStatusIcon(status)}
      {getStatusLabel(status)}
    </Badge>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "complete": return "bg-green-100 text-green-800";
    case "edited": return "bg-blue-100 text-blue-800";
    case "generating": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getProjectStatusColor(status: string) {
  switch (status) {
    case "final": return "bg-purple-100 text-purple-800 border-purple-200";
    case "draft": return "bg-orange-100 text-orange-800 border-orange-200";
    case "submitted": return "bg-green-100 text-green-800 border-green-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "complete": return <Check className="mr-1 h-3 w-3" />;
    case "edited": return <Edit className="mr-1 h-3 w-3" />;
    case "generating": return <Clock className="mr-1 h-3 w-3" />;
    default: return <Clock className="mr-1 h-3 w-3" />;
  }
}

function getProjectStatusIcon(status: string) {
  switch (status) {
    case "final": return <CheckCircle2 className="mr-1 h-3 w-3" />;
    case "draft": return <Edit className="mr-1 h-3 w-3" />;
    case "submitted": return <Check className="mr-1 h-3 w-3" />;
    default: return <Clock className="mr-1 h-3 w-3" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "complete": return "Complete";
    case "edited": return "Edited";
    case "generating": return "Generating";
    case "pending": return "Pending";
    default: return status;
  }
}

function getProjectStatusLabel(status: string) {
  switch (status) {
    case "final": return "Final";
    case "draft": return "Draft";
    case "submitted": return "Submitted";
    default: return status;
  }
}
