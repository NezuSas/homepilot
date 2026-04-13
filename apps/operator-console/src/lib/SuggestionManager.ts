/**
 * SuggestionManager
 * Passive intelligence layer that tracks user behavior (e.g., toggling a device)
 * and suggests automations if patterns are detected.
 */

interface ActionTrack {
  deviceId: string;
  timestamps: number[];
}

export class SuggestionManager {
  private static STORAGE_KEY = 'hp_suggestion_tracks';
  private static PATTERN_THRESHOLD = 3; // Number of times before suggesting

  /**
   * Tracks a manual action on a device.
   */
  public static trackAction(deviceId: string) {
    const tracks = this.getTracks();
    const track = tracks[deviceId] || { deviceId, timestamps: [] };
    
    track.timestamps.push(Date.now());
    
    // Keep only last 10 timestamps to avoid bloat
    if (track.timestamps.length > 10) {
      track.timestamps.shift();
    }
    
    tracks[deviceId] = track;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tracks));
  }

  /**
   * Checks if there's a suggestion for a device.
   */
  public static getSuggestion(deviceId: string): string | null {
    const tracks = this.getTracks();
    const track = tracks[deviceId];
    
    if (!track || track.timestamps.length < this.PATTERN_THRESHOLD) return null;

    // Very simple heuristic: if 3 actions happened within same hour across different days
    // or just frequent enough, suggest it.
    const hours = track.timestamps.map(ts => new Date(ts).getHours());
    const uniqueHours = new Set(hours);
    
    if (uniqueHours.size === 1) {
      return `You frequently use this device at ${hours[0]}:00. Want to automate it?`;
    }

    return null;
  }

  private static getTracks(): Record<string, ActionTrack> {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
