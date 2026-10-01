import { cn } from '../utils';

describe('shared semantic color and typography composition', () => {
  it.each(['body-compact', 'caption', 'micro', 'sensor-title-fluid', 'clock-time-md-fluid'])('keeps primary ink alongside %s typography', size => {
    expect(cn('text-primary-foreground', `text-${size}`)).toBe(`text-primary-foreground text-${size}`);
  });
  it('allows overriding size without removing the semantic color', () => {
    expect(cn('text-primary-foreground text-body-compact', 'text-caption')).toBe('text-primary-foreground text-caption');
  });
  it('allows overriding color without removing typography', () => {
    expect(cn('text-primary text-caption', 'text-muted-foreground')).toBe('text-caption text-muted-foreground');
  });
});
