import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onUpload: (file: File, category?: string) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  category?: string;
}

export function FileUpload({ onUpload, accept = ".pdf,.doc,.docx,.txt", multiple = false, category }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0]; // Handle single file for now
      await onUpload(file, category);
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been processed.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, category, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  return (
    <Card 
      className={`border-2 border-dashed transition-colors cursor-pointer ${
        isDragging 
          ? "border-primary-400 bg-primary-50" 
          : "border-slate-300 hover:border-slate-400"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <CloudUpload className="text-2xl text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          Drop files here or click to upload
        </h3>
        <p className="text-slate-500 mb-4">
          Support for PDF, DOC, DOCX, TXT files up to 10MB each
        </p>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={isUploading}
        />
        <Button 
          asChild
          disabled={isUploading}
          className="bg-primary-600 hover:bg-primary-700"
        >
          <label htmlFor="file-upload" className="cursor-pointer">
            {isUploading ? "Uploading..." : "Choose Files"}
          </label>
        </Button>
      </CardContent>
    </Card>
  );
}
