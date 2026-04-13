/**
 * Utility for converting technical entity names/IDs into human-readable Title Case strings.
 * Used to "cloak" the technical complexity of the smart home system.
 */

export const humanize = (id: string, name?: string): string => {
  // 1. If we have a name, use it as baseline
  let base = name || id;

  // 2. Remove common prefixes
  const prefixes = [
    'home.', 'sensor.', 'binary_sensor.', 'switch.', 'light.', 
    'media_player.', 'climate.', 'cover.', 'fan.', 'lock.'
  ];
  
  for (const prefix of prefixes) {
    if (base.startsWith(prefix)) {
      base = base.substring(prefix.length);
      break;
    }
  }

  // 3. Convert snake_case or-kebab-case to Title Case
  // e.g. master_bedroom_light -> Master Bedroom Light
  return base
    .split(/[_\-\.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
};

/**
 * Disambiguates names if they are likely to collide.
 * e.g. if we have two "Desk Light" devices.
 */
export const disambiguate = (name: string, roomName?: string): string => {
  if (!roomName) return name;
  return `${name} (${roomName})`;
};
