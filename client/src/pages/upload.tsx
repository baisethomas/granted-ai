import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Building, 
  Trophy, 
  Calculator, 
  Users,
  FileText,
  RefreshCw,
  MoreHorizontal,
  Check,
  Clock,
  Trash2
} from "lucide-react";

const documentCategories = [
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

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return 'fas fa-file-pdf text-red-600';
  if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word text-blue-600';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel text-green-600';
  return 'fas fa-file-alt text-gray-600';
};

const getCategoryColor = (category?: string) => {
  switch (category) {
    case 'organization-info': return 'bg-blue-100 text-blue-800';
    case 'past-successes': return 'bg-green-100 text-green-800';
    case 'budgets': return 'bg-purple-100 text-purple-800';
    case 'team-info': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryLabel = (category?: string) => {
  const cat = documentCategories.find(c => c.id === category);
  return cat?.title || category || 'Other';
};

export default function Upload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ["/api/documents"],
    meta: {
      onSuccess: (data: any) => {
        console.log('Documents query result:', data);
      },
      onError: (error: any) => {
        console.error('Documents query error:', error);
      }
    }
  });

  console.log('Current documents state:', { documents, isLoading, error });

  const uploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category?: string }) =>
      api.uploadDocument(file, category),
    onSuccess: (data) => {
      console.log('Upload successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document uploaded",
        description: `${data.originalName} has been uploaded successfully.`,
      });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
    },
  });

  const handleUpload = async (file: File, category?: string) => {
    await uploadMutation.mutateAsync({ file, category });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (date: string) => {
    const now = new Date();
    const uploadDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return uploadDate.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Documents</h2>
          <p className="text-slate-600 mb-8">
            Add your organization documents to build context for AI-powered grant writing. 
            These files help the AI understand your mission, capabilities, and past successes.
          </p>

          <FileUpload onUpload={handleUpload} />

          {/* Document Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {documentCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Card key={category.id} className="border border-slate-200">
                  <CardContent className="p-4 text-center">
                    <div className={`w-12 h-12 ${category.bgColor} rounded-lg mx-auto mb-3 flex items-center justify-center`}>
                      <Icon className={`${category.iconColor} h-6 w-6`} />
                    </div>
                    <h4 className="font-medium text-slate-900 mb-2">{category.title}</h4>
                    <p className="text-sm text-slate-600">{category.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Uploaded Documents
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('Manual refresh triggered');
                queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No documents uploaded yet</h3>
              <p className="text-slate-600">Upload your first document to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {documents.map((document: any) => (
                <div key={document.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <i className={getFileIcon(document.fileType)}></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{document.originalName}</h4>
                      <p className="text-sm text-slate-600">
                        {document.fileType.split('/')[1].toUpperCase()} • {formatFileSize(document.fileSize)} • Uploaded {formatDate(document.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(document.category)}`}>
                      {getCategoryLabel(document.category)}
                    </Badge>
                    <Badge className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      document.processed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {document.processed ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Processed
                        </>
                      ) : (
                        <>
                          <Clock className="mr-1 h-3 w-3" />
                          Processing
                        </>
                      )}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(document.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
