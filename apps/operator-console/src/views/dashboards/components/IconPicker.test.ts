import { CircleHelp } from 'lucide-react';
import { getDashboardIconComponent } from './IconPicker';

describe('getDashboardIconComponent', () => {
  it('resolves the persisted Home Assistant icon aliases included in the compact catalog', () => {
    expect(getDashboardIconComponent('mdi:lightbulb')).not.toBe(CircleHelp);
    expect(getDashboardIconComponent('mdi:power-plug')).not.toBe(CircleHelp);
    expect(getDashboardIconComponent('mdi:weather-windy')).not.toBe(CircleHelp);
  });

  it('keeps unknown persisted values safe by returning the existing fallback', () => {
    expect(getDashboardIconComponent('mdi:not-an-icon')).toBe(CircleHelp);
  });
});