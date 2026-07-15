import React from 'react';

interface DashboardAtmosphereRippleProps {
  active: boolean;
}

export const DashboardAtmosphereRipple: React.FC<DashboardAtmosphereRippleProps> = ({ active }) => {
  if (!active) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-atmosphere h-atmosphere rounded-full border border-primary/20 animate-luxury-ripple" />
    </div>
  );
};
