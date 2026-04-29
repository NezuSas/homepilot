/**
 * Centralized ID generator for the frontend.
 * Provides a 3-tier fallback strategy to ensure compatibility across:
 * 1. Modern browsers in secure contexts (randomUUID)
 * 2. Older browsers/WebView in secure contexts (getRandomValues)
 * 3. Non-secure contexts (HTTP) or legacy environments (Pseudorandom entropy)
 */

let counter = 0;

/**
 * Generates a unique identifier string.
 * This function is synchronous, dependency-free, and guaranteed to return a non-empty string.
 */
export function generateId(prefix?: string): string {
  let id: string;

  try {
    // Tier 1: Modern Secure Context (Standard UUID v4)
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      id = globalThis.crypto.randomUUID();
    } 
    // Tier 2: Legacy Secure Context (Manual UUID v4)
    else if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      
      // Set RFC4122 v4 version (4) and variant (10xx)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      
      id = Array.from(bytes)
        .map((b, i) => {
          const hex = b.toString(16).padStart(2, '0');
          if (i === 4 || i === 6 || i === 8 || i === 10) return '-' + hex;
          return hex;
        })
        .join('');
    }
    // Tier 3: Insecure Context / Fallback (Date + Random + Counter)
    else {
      id = fallbackId();
    }
  } catch {
    id = fallbackId();
  }

  // Final safety check: ensure we never return an empty or invalid value
  if (!id) id = fallbackId();

  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Robust pseudorandom ID generation for environments without Web Crypto API.
 * Combines timestamp, high-entropy math random, and an incremental counter.
 */
function fallbackId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const countPart = (counter++).toString(36);
  
  // Reset counter to prevent overflow over long sessions, 
  // though 36^k is quite large.
  if (counter > 1000000) counter = 0;
  
  return `${timestamp}-${randomPart}-${countPart}`;
}
