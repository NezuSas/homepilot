import { Heading } from '../components/ui/Heading';
import { StatusPill } from '../components/ui/StatusPill';
import { designBookDemos } from './demos';
import { BRAND } from '../brand';

/**
 * Renders every demo (or only the one named by `only`) on a full-screen stage that looks like the app:
 * a top bar with the brand and the content centred in the remaining space. The capture is the whole
 * viewport, so the book shows the component on a real device screen.
 */
export function DesignBook({ only }: { only?: string | null }) {
  const names = only ? Object.keys(designBookDemos).filter(name => name === only) : Object.keys(designBookDemos);
  return (
    <>
      {names.map(name => {
        const demo = designBookDemos[name];
        return (
          <section
            key={name}
            data-book-component={name}
            data-book-capture="viewport"
            data-book-open={demo.openSelector}
            className="flex min-h-dvh flex-col bg-background text-foreground"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6 [@media(pointer:coarse)_and_(max-width:900px)]:pt-11 [@media(pointer:coarse)_and_(max-height:500px)]:pl-14">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/logo.svg" alt="" className="h-7 w-auto" />
                <Heading variant="item" as="p">{BRAND.productName}</Heading>
              </div>
              <StatusPill variant="success" size="sm" uppercase>Conectado</StatusPill>
            </header>
            <div className="flex min-w-0 flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-8 [@media(pointer:coarse)_and_(max-height:500px)]:pl-16">
              <div className="w-full max-w-6xl">{demo.render()}</div>
            </div>
          </section>
        );
      })}
    </>
  );
}
