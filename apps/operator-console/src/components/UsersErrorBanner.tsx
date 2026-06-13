import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface UsersErrorBannerProps {
  message: string;
}

export const UsersErrorBanner: React.FC<UsersErrorBannerProps> = ({ message }) => (
  <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm flex items-center">
    <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />
    {message}
  </div>
);
