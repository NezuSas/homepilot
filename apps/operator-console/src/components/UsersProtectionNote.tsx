import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AlertBanner } from './ui/AlertBanner';

interface UsersProtectionNoteProps {
  message: string;
}

export const UsersProtectionNote: React.FC<UsersProtectionNoteProps> = ({ message }) => (
  <AlertBanner variant="info" icon={ShieldAlert} message={message} className="py-3 [&_p]:text-caption" />
);
