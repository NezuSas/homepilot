import React from 'react';
import { ArrowRight, LayoutDashboard } from 'lucide-react';

interface HomeDashboardButtonProps {
  label: string;
  accessibleLabel: string;
  disabled?: boolean;
  onActivate: () => void;
}

export const HomeDashboardButton: React.FC<HomeDashboardButtonProps> = ({
  label, accessibleLabel, disabled = false, onActivate,
}) => (
  <button
    type="button"
    className="homepilot-home-dashboard-button relative z-20 self-end"
    disabled={disabled}
    aria-label={accessibleLabel}
    title={disabled ? accessibleLabel : undefined}
    onClick={onActivate}
  >
    <LayoutDashboard size={18} aria-hidden="true" />
    <span>{label}</span>
    <ArrowRight className="homepilot-home-dashboard-button-arrow" size={18} aria-hidden="true" />
  </button>
);
