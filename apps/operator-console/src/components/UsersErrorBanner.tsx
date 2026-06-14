import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AlertBanner } from './ui/AlertBanner';

interface UsersErrorBannerProps {
  message: string;
}

export const UsersErrorBanner: React.FC<UsersErrorBannerProps> = ({ message }) => (
  <AlertBanner variant="danger" icon={ShieldAlert} message={message} />
);
