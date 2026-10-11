import { getTitleLayoutClasses, readTitleAlign, readTitleWidthMode, resolveTitleMarkdown } from './dashboardTitleSettings';

describe('dashboardTitleSettings', () => {
  it('reads alignment with a fallback for unknown values', () => {
    expect(readTitleAlign('right', 'center')).toBe('right');
    expect(readTitleAlign('diagonal', 'left')).toBe('left');
    expect(readTitleAlign(undefined, 'center')).toBe('center');
  });

  it('reads width mode defaulting to full', () => {
    expect(readTitleWidthMode('half')).toBe('half');
    expect(readTitleWidthMode('third')).toBe('third');
    expect(readTitleWidthMode('other')).toBe('full');
  });

  it('prefers stored markdown and composes a default otherwise', () => {
    expect(resolveTitleMarkdown({ markdown: '# Hi' }, 'Ignored', 'T', 'S')).toBe('# Hi');
    expect(resolveTitleMarkdown({ markdown: '  ' }, 'Home', 'T', 'S')).toBe('# Home\nS');
    expect(resolveTitleMarkdown({ subtitle: 'Sub' }, undefined, 'T', 'S')).toBe('# T\nSub');
    expect(resolveTitleMarkdown({ subtitle: '' }, 'Home', 'T', 'S')).toBe('# Home');
  });

  it('maps alignment and width to layout classes', () => {
    expect(getTitleLayoutClasses('left', 'half', 'right')).toEqual({
      alignmentClass: 'items-start text-left',
      widthClass: 'w-1/2',
      blockJustifyClass: 'justify-end',
    });
    expect(getTitleLayoutClasses('center', 'full', 'center')).toEqual({
      alignmentClass: 'items-center text-center',
      widthClass: 'w-full',
      blockJustifyClass: 'justify-center',
    });
  });
});
