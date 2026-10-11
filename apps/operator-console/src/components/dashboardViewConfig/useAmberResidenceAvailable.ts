import { useEffect, useState } from 'react';
import { dashboardBackgroundPresets } from '../../lib/dashboardBackgroundPresets';

export const AMBER_RESIDENCE_PRESET_ID = 'homepilot-amber-residence';
const AMBER_RESIDENCE_SOURCE = dashboardBackgroundPresets.find((preset) => preset.id === AMBER_RESIDENCE_PRESET_ID)?.src;

/** The amber preset is optional art: only offer it once its image actually loads. */
export function useAmberResidenceAvailable(isOpen: boolean): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isOpen || !AMBER_RESIDENCE_SOURCE) return;
    const image = new window.Image();
    let active = true;
    image.onload = () => { if (active) setAvailable(true); };
    image.onerror = () => { if (active) setAvailable(false); };
    image.src = AMBER_RESIDENCE_SOURCE;
    return () => { active = false; };
  }, [isOpen]);

  return available;
}
