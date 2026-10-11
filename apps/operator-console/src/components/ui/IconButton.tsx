import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, type ButtonProps } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: 'default' | 'ghost' | 'primary' | 'danger';
  /** Compatibility aliases: every icon action uses the same 44px target. */
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variants: Record<NonNullable<IconButtonProps['variant']>, NonNullable<ButtonProps['variant']>> = {
  default: 'secondary',
  ghost: 'ghost',
  primary: 'primary',
  danger: 'danger',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, variant = 'default', size = 'md', isLoading = false, className, disabled, title, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      aria-label={label}
      title={title || label}
      disabled={disabled}
      isLoading={isLoading}
      variant={variants[variant]}
      size="icon"
      data-legacy-size={size}
      className={cn(className)}
      {...props}
    >
      {!isLoading && <Icon aria-hidden="true" focusable="false" className="h-4 w-4" />}
    </Button>
  )
);
IconButton.displayName = 'IconButton';
