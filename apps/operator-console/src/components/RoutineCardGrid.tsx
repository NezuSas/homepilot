import type { PropsWithChildren } from 'react';

/** Bounded tracks keep routine cards compact, including before favorites load. */
export function RoutineCardGrid({ children }: PropsWithChildren) {
  return <div className="grid min-w-0 w-full grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),min(100%,20rem)))] items-start gap-3">{children}</div>;
}
