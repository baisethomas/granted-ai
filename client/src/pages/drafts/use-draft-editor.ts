import { useState, useEffect, useCallback } from "react";

interface UseDraftEditorProps {
  onSave: (questionId: string, content: string) => Promise<void>;
}

/**
 * Custom hook for managing draft editing state and auto-save
 */
export function useDraftEditor({ onSave }: UseDraftEditorProps) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(0);

  const calculateWordCount = useCallback((text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  const handleAutoSave = useCallback(async () => {
    if (editingQuestionId && editedContent !== originalContent && editedContent.trim()) {
      try {
        await onSave(editingQuestionId, editedContent);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }
  }, [editingQuestionId, editedContent, originalContent, onSave]);

  // Auto-save with debouncing
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    if (hasUnsavedChanges && editedContent !== originalContent && editedContent.trim().length > 0) {
      const timeoutId = setTimeout(() => {
        handleAutoSave();
      }, 3000);

      setAutoSaveTimeout(timeoutId);
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [editedContent, originalContent, hasUnsavedChanges]);

  // Update word count when content changes
  useEffect(() => {
    if (editedContent !== undefined) {
      setWordCount(calculateWordCount(editedContent));
    }
  }, [editedContent, calculateWordCount]);

  const startEditing = (questionId: string, currentContent: string) => {
    if (editingQuestionId && hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Do you want to discard them and start editing this response?"
      );
      if (!confirmDiscard) return;
    }

    setEditingQuestionId(questionId);
    setEditedContent(currentContent || "");
    setOriginalContent(currentContent || "");
    setHasUnsavedChanges(false);
  };

  const cancelEditing = () => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Are you sure you want to discard them?"
      );
      if (!confirmDiscard) return;
    }

    setEditingQuestionId(null);
    setEditedContent("");
    setOriginalContent("");
    setHasUnsavedChanges(false);
  };

  const saveEditing = async () => {
    if (editingQuestionId && editedContent.trim()) {
      await onSave(editingQuestionId, editedContent);
      setEditingQuestionId(null);
      setEditedContent("");
      setOriginalContent("");
      setHasUnsavedChanges(false);
    }
  };

  const handleContentChange = (content: string) => {
    setEditedContent(content);
    setHasUnsavedChanges(content !== originalContent);
  };

  return {
    editingQuestionId,
    editedContent,
    originalContent,
    hasUnsavedChanges,
    wordCount,
    startEditing,
    cancelEditing,
    saveEditing,
    handleContentChange,
  };
}
