import { Building, Trophy, Calculator, Users, Check, Clock, AlertTriangle } from "lucide-react";

export const documentCategories = [
  {
    id: "organization-info",
    title: "Organization Info",
    description: "Mission statements, bylaws, 990 forms",
    icon: Building,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600"
  },
  {
    id: "past-successes",
    title: "Past Successes",
    description: "Awarded grants, impact reports",
    icon: Trophy,
    bgColor: "bg-green-100",
    iconColor: "text-green-600"
  },
  {
    id: "budgets",
    title: "Budgets",
    description: "Financial statements, budget templates",
    icon: Calculator,
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600"
  },
  {
    id: "team-info",
    title: "Team Info",
    description: "Staff bios, organizational chart",
    icon: Users,
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600"
  }
];

export function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return 'fas fa-file-pdf text-red-600';
  if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word text-blue-600';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel text-green-600';
  return 'fas fa-file-alt text-gray-600';
}

export function getCategoryColor(category?: string) {
  switch (category) {
    case 'organization-info': return 'bg-blue-100 text-blue-800';
    case 'past-successes': return 'bg-green-100 text-green-800';
    case 'budgets': return 'bg-purple-100 text-purple-800';
    case 'team-info': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getCategoryLabel(category?: string) {
  const cat = documentCategories.find(c => c.id === category);
  return cat?.title || category || 'Other';
}

export function getProcessingBadge(document: any) {
  const status = document.processingStatus || (document.processed ? "complete" : "pending");
  switch (status) {
    case "complete":
      return {
        color: "bg-green-100 text-green-800",
        icon: Check,
        label: "Ready",
      };
    case "failed":
      return {
        color: "bg-red-100 text-red-800",
        icon: AlertTriangle,
        label: "Failed",
      };
    case "processing":
    case "pending":
    default:
      return {
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
        label: "Processing",
      };
  }
}
