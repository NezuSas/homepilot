import { Heading } from '../../../components/ui/Heading';
import type { markdownToBlocks } from './dashboardTitleContent';

type TitleBlocks = ReturnType<typeof markdownToBlocks>;

/** Renders the parsed markdown blocks of a dashboard title. */
export function DashboardTitleBlocks({ blocks }: { blocks: TitleBlocks }) {
  return (
    <>
      {blocks.map((block) => {
        if (block.type === 'space') {
          return <div key={block.key} className="h-widget-spacer" />;
        }

        if (block.type === 'h1') {
          return (
            <Heading
              key={block.key}
              as="h1"
              variant="view"
              className="max-w-full truncate text-widget-title-fluid font-black leading-tight"
            >
              {block.text}
            </Heading>
          );
        }

        if (block.type === 'h2') {
          return (
            <Heading
              key={block.key}
              as="h2"
              variant="section"
              className="max-w-full truncate text-widget-title-compact-fluid font-black leading-tight text-foreground"
            >
              {block.text}
            </Heading>
          );
        }

        if (block.type === 'h3') {
          return (
            <Heading
              key={block.key}
              as="h3"
              variant="card"
              className="max-w-full truncate text-widget-title-small-fluid leading-tight"
            >
              {block.text}
            </Heading>
          );
        }

        return (
          <p
            key={block.key}
            className="min-w-0 max-w-full truncate text-widget-caption-fluid font-medium leading-snug text-muted-foreground"
          >
            {block.text}
          </p>
        );
      })}
    </>
  );
}
