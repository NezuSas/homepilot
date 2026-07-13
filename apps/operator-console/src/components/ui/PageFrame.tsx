import React from 'react';
import { cn } from '../../lib/utils';

export interface PageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  immersive?: boolean;
  maxWidth?: 'standard' | 'wide' | 'none';
}

const maxWidthClasses: Record<NonNullable<PageFrameProps['maxWidth']>, string> = {
  standard: 'max-w-[1280px]',
  wide: 'max-w-[1600px]',
  none: 'max-w-none',
};

export const PageFrame = React.forwardRef<HTMLDivElement, PageFrameProps>(
  ({ className, children, immersive = false, maxWidth = 'wide', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'mx-auto w-full',
        immersive
          ? 'min-h-full max-w-none'
          : 'min-h-full px-3 py-4 sm:px-5 md:px-6 md:py-6 xl:px-8 xl:py-8 animate-slide-up-fade',
        !immersive && maxWidthClasses[maxWidth],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

PageFrame.displayName = 'PageFrame';
