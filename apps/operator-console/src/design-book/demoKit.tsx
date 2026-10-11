import type { ReactNode } from 'react';
import { Heading } from '../components/ui/Heading';

/** One gallery entry per component file in components/ui. */
export interface BookDemo {
  render: () => ReactNode;
  capture?: 'element' | 'viewport';
  openSelector?: string;
}

export const noop = (): void => undefined;

/** Layout-only wrapper: responsive columns for a compact composition. */
export function DemoGrid({ children, columns = 'sm:grid-cols-2 xl:grid-cols-3' }: { children: ReactNode; columns?: string }) {
  return <div className={`grid min-w-0 gap-4 ${columns}`}>{children}</div>;
}

/** Layout-only wrapper: a caption above one variant or state. */
export function DemoItem({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Heading variant="label" as="p">{caption}</Heading>
      {children}
    </div>
  );
}
