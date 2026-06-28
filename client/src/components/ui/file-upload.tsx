import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onUpload: (file: File, category?: string) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  category?: string;
  title?: string;
  description?: ReactNode;
  fileTypesHint?: string;
  showToast?: boolean;
  disabled?: boolean;
  className?: string;
}

const defaultDescription = (
  <>
    Drop proposals, budgets & impact reports — or{" "}
    <span className="font-semibold text-[#2186EB]">browse files</span>
  </>
);

export function FileUpload({
  onUpload,
  accept = ".pdf,.doc,.docx,.txt",
  multiple = false,
  category,
  title = "Drag & drop files here",
  description = defaultDescription,
  fileTypesHint = "PDF · DOC · DOCX · TXT — up to 10 MB each",
  showToast = true,
  disabled = false,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const isDisabled = disabled || isUploading;

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || isDisabled) return;

      setIsUploading(true);
      try {
        const file = files[0];
        await onUpload(file, category);
        if (showToast) {
          toast({
            title: "File uploaded successfully",
            description: `${file.name} has been processed.`,
          });
        }
      } catch (error) {
        if (showToast) {
          toast({
            title: "Upload failed",
            description: error instanceof Error ? error.message : "Failed to upload file",
            variant: "destructive",
          });
        }
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, category, toast, showToast, isDisabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isDisabled) setIsDragging(true);
    },
    [isDisabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!isDisabled) {
        void handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect, isDisabled],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleFileSelect(e.target.files);
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const browse = useCallback(() => {
    if (!isDisabled) inputRef.current?.click();
  }, [isDisabled]);

  const dropTitle = isDragging
    ? "Release to upload"
    : isUploading
      ? "Uploading…"
      : title;

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-labelledby={`${inputId}-title`}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-6 py-[38px] text-center transition-[border-color,background] duration-150",
        isDragging
          ? "cursor-copy border-[#2186EB] bg-[#EAF2FE]"
          : "cursor-pointer border-[#C7CFDD] bg-[#FBFBFD]",
        isDisabled && "pointer-events-none opacity-60",
        className,
      )}
      onClick={browse}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          browse();
        }
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        disabled={isDisabled}
        tabIndex={-1}
      />

      <div className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#EAF2FE]">
        <Upload className="h-[26px] w-[26px] text-[#2186EB]" strokeWidth={1.75} />
      </div>

      <div id={`${inputId}-title`} className="text-base font-bold text-[#0C1B33]">
        {dropTitle}
      </div>

      {!isUploading && (
        <>
          <div className="text-sm text-[#56627A]">{description}</div>
          <div className="mt-0.5 font-mono text-[11px] text-[#8A94A6]">{fileTypesHint}</div>
        </>
      )}
    </div>
  );
}
