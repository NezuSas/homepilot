import { getWidgetAccentStyle, getWidgetContentStyle, getWidgetFrameClass, getWidgetRootStyle } from './dashboardWidgetPresentation';

const frame = { isSection: false, isCamera: false, isDevice: false, isEditing: false, isSelected: false, hasClockEditTools: false, accentColor: undefined, variant: undefined };

describe('dashboard widget presentation', () => {
  it('tints accent-colored widgets and leaves others untouched', () => {
    expect(getWidgetAccentStyle(undefined)).toEqual({});
    expect(getWidgetAccentStyle('#ff0000')).toEqual({ borderColor: '#ff0000', backgroundColor: '#ff000012', borderWidth: '2px', borderStyle: 'solid' });
  });

  it('sizes clock widgets from their grid footprint', () => {
    expect(getWidgetRootStyle({}, null, false)).toEqual({ containerType: 'inline-size' });
    const clock = getWidgetRootStyle({}, { columns: 6, rows: 'auto' }, false);
    expect(clock).toMatchObject({ containerType: 'size', containerName: 'clock-card', borderWidth: 0, width: 'calc(50% - 4px)', minHeight: 0 });
    expect(getWidgetRootStyle({}, { columns: 6, rows: 'auto' }, true)).toMatchObject({ containerType: 'inline-size', containerName: undefined, height: 'auto', backgroundColor: 'transparent' });
  });

  it('only turns the content wrapper into a size container while editing a clock', () => {
    expect(getWidgetContentStyle(null, false)).toBeUndefined();
    expect(getWidgetContentStyle({ columns: 6, rows: 2 }, false)).toEqual({ borderRadius: 'inherit' });
    expect(getWidgetContentStyle({ columns: 6, rows: 2 }, true)).toMatchObject({ borderRadius: 'inherit', containerType: 'size', containerName: 'clock-card', flexShrink: 0 });
  });

  it('picks the frame variant classes', () => {
    expect(getWidgetFrameClass({ ...frame, isDevice: true })).toContain('shadow-xl');
    expect(getWidgetFrameClass({ ...frame, variant: 'glass' })).toContain('backdrop-blur-3xl');
    expect(getWidgetFrameClass(frame)).toContain('bg-card border border-border/60');
    expect(getWidgetFrameClass({ ...frame, accentColor: '#fff', variant: 'flat' })).not.toContain('bg-muted/30');
    expect(getWidgetFrameClass({ ...frame, isCamera: true })).toContain('bg-transparent shadow-none');
    expect(getWidgetFrameClass({ ...frame, isSection: true, isEditing: true, isSelected: true })).toContain('outline-primary');
    expect(getWidgetFrameClass({ ...frame, isSection: true })).toContain('rounded-2xl');
    expect(getWidgetFrameClass({ ...frame, hasClockEditTools: true })).toContain('flex flex-col');
  });
});
