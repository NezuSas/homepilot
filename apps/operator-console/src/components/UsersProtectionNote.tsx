import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface UsersProtectionNoteProps {
  message: string;
}

export const UsersProtectionNote: React.FC<UsersProtectionNoteProps> = ({ message }) => (
  <p className="flex items-start gap-2 text-caption text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{message}</p>
);
