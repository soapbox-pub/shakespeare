/**
 * Utilities for generating unused Nostr event kind numbers
 */

export interface KindRangeInfo {
  name: string;
  min: number;
  max: number;
  description: string;
}

export type KindRange = 'regular' | 'replaceable' | 'ephemeral' | 'addressable';

/**
 * Generator for unused Nostr event kind numbers
 */
export class KindGenerator {
  /**
   * Extract used kind numbers from the NIPs index
   */
  static extractUsedKinds(nipsIndex: string): Set<number> {
    const usedKinds = new Set<number>();

    // Look for kind numbers in the Event Kinds table
    // Format: | `1234` | description | NIP |
    // Also handle ranges like `5000`-`5999`

    const kindPatterns = [
      // Single kind in backticks: `1234`
      /\|\s*`(\d+)`\s*\|/g,
      // Range in backticks: `5000`-`5999`
      /\|\s*`(\d+)`-`(\d+)`\s*\|/g,
      // Range in backticks with single digit end: `39000-9`
      /\|\s*`(\d+)-(\d+)`\s*\|/g,
    ];

    for (const pattern of kindPatterns) {
      let match;
      while ((match = pattern.exec(nipsIndex)) !== null) {
        if (match[2] !== undefined && match[1] !== undefined) {
          // Handle range format like `5000`-`5999` or `39000-9`
          const start = parseInt(match[1], 10);
          let end = parseInt(match[2], 10);

          // Handle special case like `39000-9` which means 39000-39009
          if (end < start && end < 10) {
            const startStr = match[1];
            const endStr = match[2];
            if (startStr && endStr) {
              // Replace the last digit(s) of start with end
              const prefix = startStr.slice(0, -endStr.length);
              end = parseInt(prefix + endStr, 10);
            }
          }

          if (
            !isNaN(start) && !isNaN(end) && start >= 0 && end >= 0 &&
            start <= 65535 && end <= 65535 && start <= end
          ) {
            // Add all numbers in the range
            for (let i = start; i <= end; i++) {
              usedKinds.add(i);
            }
          }
        } else if (match[1] !== undefined) {
          // Handle single kind format like `1234`
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num >= 0 && num <= 65535) {
            usedKinds.add(num);
          }
        }
      }
    }

    return usedKinds;
  }

  /**
   * Generate an available kind number in the specified range
   */
  static generateAvailableKind(
    range: KindRange,
    usedKinds: Set<number>,
  ): number {
    const rangeInfo = this.getKindRangeInfo(range);

    // Create a set of all numbers to avoid (used kinds + buffer)
    const kindsToAvoid = new Set<number>();
    
    // Add used kinds and their buffer zones
    for (const usedKind of usedKinds) {
      kindsToAvoid.add(usedKind);
      // Add buffer of 2 kinds on each side
      kindsToAvoid.add(usedKind - 2);
      kindsToAvoid.add(usedKind - 1);
      kindsToAvoid.add(usedKind + 1);
      kindsToAvoid.add(usedKind + 2);
    }

    // Collect all available numbers in the range
    const availableKinds: number[] = [];
    for (let i = rangeInfo.min; i <= rangeInfo.max; i++) {
      // Skip if in range to avoid
      if (kindsToAvoid.has(i)) {
        continue;
      }
      
      // Skip even numbers
      if (i % 2 === 0) {
        continue;
      }
      
      // Skip multiples of 5
      if (i % 5 === 0) {
        continue;
      }
      
      availableKinds.push(i);
    }

    // If no available numbers, fall back to first valid number in range
    if (availableKinds.length === 0) {
      for (let i = rangeInfo.min; i <= rangeInfo.max; i++) {
        // Find first odd number that's not a multiple of 5
        if (i % 2 !== 0 && i % 5 !== 0) {
          return i;
        }
      }
      // Ultimate fallback
      return rangeInfo.min;
    }

    // Return a random available number
    const randomIndex = Math.floor(Math.random() * availableKinds.length);
    return availableKinds[randomIndex]!;
  }

  /**
   * Get information about a kind range
   */
  static getKindRangeInfo(range: KindRange): KindRangeInfo {
    switch (range) {
      case 'regular':
        return {
          name: 'Regular Events',
          min: 1000,
          max: 9999,
          description:
            'Regular events for application-specific use cases. These events are stored permanently.',
        };
      case 'replaceable':
        return {
          name: 'Replaceable Events',
          min: 10000,
          max: 19999,
          description:
            'Events that can be replaced by newer versions from the same author.',
        };
      case 'ephemeral':
        return {
          name: 'Ephemeral Events',
          min: 20000,
          max: 29999,
          description: 'Events that are not stored permanently by relays.',
        };
      case 'addressable':
        return {
          name: 'Addressable Events',
          min: 30000,
          max: 39999,
          description:
            'Events that can be addressed and replaced using the "d" tag identifier.',
        };
      default:
        throw new Error(`Unknown range: ${range}`);
    }
  }
}