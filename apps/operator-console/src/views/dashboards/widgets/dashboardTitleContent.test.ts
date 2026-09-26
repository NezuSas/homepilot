import { markdownToBlocks, parseBadges, renderTemplate } from './dashboardTitleContent';

describe('dashboard title content', () => {
  it('keeps only supported badge records from persisted data', () => {
    expect(parseBadges([
      { id: 'weather-1', kind: 'weather' },
      { id: 'tab-1', kind: 'tab', tabId: 'living' },
      { id: 1, kind: 'time' },
      { id: 'unknown', kind: 'custom' },
    ])).toEqual([
      { id: 'weather-1', kind: 'weather' },
      { id: 'tab-1', kind: 'tab', tabId: 'living' },
    ]);
  });

  it('preserves heading levels and intentional blank lines', () => {
    expect(markdownToBlocks('# Home\n\n## Living\nA calm house')).toEqual([
      { key: 0, type: 'h1', text: 'Home' },
      { key: 1, type: 'space', text: '' },
      { key: 2, type: 'h2', text: 'Living' },
      { key: 3, type: 'p', text: 'A calm house' },
    ]);
  });

  it('uses a fallback name for both supported template languages', () => {
    expect(renderTemplate('Hi {{user}}, hola {{usuario}}', 'Ana')).toBe('Hi Ana, hola Ana');
  });
});
