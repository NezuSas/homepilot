import { useEffect, useState } from 'react';

interface TitleEditorStateOptions {
  markdown: string;
  isEditing: boolean;
  isSelected: boolean;
  editRequest: number;
  onEditorOpenChange?: (isOpen: boolean) => void;
}

/** Inline title editor open/draft state, synced with selection and edit requests. */
export function useTitleEditorState({ markdown, isEditing, isSelected, editRequest, onEditorOpenChange }: TitleEditorStateOptions) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState(markdown);

  useEffect(() => {
    setDraftMarkdown(markdown);
  }, [markdown]);

  useEffect(() => {
    if (isEditing && isSelected) setIsEditorOpen(true);
  }, [isEditing, isSelected]);

  useEffect(() => {
    if (isEditing && editRequest > 0) setIsEditorOpen(true);
  }, [editRequest, isEditing]);

  useEffect(() => {
    onEditorOpenChange?.(isEditorOpen);
  }, [isEditorOpen, onEditorOpenChange]);

  return { isEditorOpen, setIsEditorOpen, draftMarkdown, setDraftMarkdown };
}
