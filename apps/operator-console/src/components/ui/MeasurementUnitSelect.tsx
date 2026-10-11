import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';
import { SearchableSelectField } from './SearchableSelectField';

export const measurementUnits = ['', '%', '°C', '°F', 'K', 'Pa', 'hPa', 'kPa', 'MPa', 'bar', 'mbar', 'psi',
  'V', 'mV', 'A', 'mA', 'W', 'kW', 'MW', 'VA', 'kVA', 'Wh', 'kWh', 'MWh', 'J', 'kJ', 'Hz', 'kHz',
  'Ω', 'kΩ', 'lx', 'lm', 'ppm', 'ppb', 'µg/m³', 'mg/m³', 'g/m³', 'dB', 'dBm', 'm', 'cm', 'mm', 'km',
  'm²', 'm³', 'L', 'mL', 'L/min', 'L/h', 'm³/h', 'm/s', 'km/h', 'rpm', 'N', 'Nm', 'kg', 'g', 's', 'ms',
  'min', 'h', 'B', 'kB', 'MB', 'GB', 'TB', 'bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s'] as const;

export interface MeasurementUnitSelectProps extends Omit<ComponentPropsWithoutRef<typeof SearchableSelectField>, 'options'> {
  /** Text for the empty unit option. */
  noUnitLabel: string;
}

export function MeasurementUnitSelect({ value, noUnitLabel, className, ...props }: MeasurementUnitSelectProps) {
  const units: readonly string[] = measurementUnits.includes(value as typeof measurementUnits[number])
    ? measurementUnits : [...measurementUnits, value];
  return <SearchableSelectField {...props} className={cn(className)} value={value}
    options={units.map(unit => ({ value: unit, label: unit || noUnitLabel }))} />;
}
