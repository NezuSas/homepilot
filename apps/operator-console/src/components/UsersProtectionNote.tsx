import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface UsersProtectionNoteProps {
  message: string;
}

export const UsersProtectionNote: React.FC<UsersProtectionNoteProps> = ({ message }) => (
  <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center">
    <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
      <ShieldAlert className="w-4 h-4 inline-block mr-1 mb-0.5" />
      {message}
    </p>
  </div>
);
