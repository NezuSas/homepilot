import React from 'react';
import { AlertBanner } from './ui/AlertBanner';

interface AutomationBuilderErrorProps {
  message: string;
}

export const AutomationBuilderError: React.FC<AutomationBuilderErrorProps> = ({ message }) => (
  <AlertBanner variant="danger" size="sm" className="animate-shake" message={message} />
);
