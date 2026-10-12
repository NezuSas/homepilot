import React from 'react';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/Button';

interface HomeDashboardButtonProps {
  label: string;
  accessibleLabel: string;
  disabled?: boolean;
  onActivate: () => void;
}

export const HomeDashboardButton: React.FC<HomeDashboardButtonProps> = ({
  label, accessibleLabel, disabled = false, onActivate,
}) => (
  <Button
    type="button"
    variant="secondary"
    size="md"
    className="homepilot-home-dashboard-button relative z-20 self-end border-primary/[0.78] hover:border-primary disabled:pointer-events-auto disabled:opacity-100"
    style={{ minHeight: '3.25rem', padding: '0.65rem 1.1rem', gap: '0.7rem', borderRadius: '999px' }}
    disabled={disabled}
    aria-label={accessibleLabel}
    title={disabled ? accessibleLabel : undefined}
    onClick={onActivate}
  >
    <LayoutDashboard size={18} aria-hidden="true" />
    <span>{label}</span>
    <ArrowRight className="homepilot-home-dashboard-button-arrow" size={18} aria-hidden="true" />
  </Button>
);
