import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AlertBanner } from './ui/AlertBanner';

interface UsersProtectionNoteProps {
  message: string;
}

export const UsersProtectionNote: React.FC<UsersProtectionNoteProps> = ({ message }) => (
  <AlertBanner variant="warning" icon={ShieldAlert} message={message} />
);
