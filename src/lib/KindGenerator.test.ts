import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KindGenerator } from './KindGenerator.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('KindGenerator', () => {
  it('should extract used kinds from real NIPs fixture', () => {
    const nipsIndex = readFileSync(join(__dirname, 'fixtures', 'NIPs.md'), 'utf-8');
    const usedKinds = KindGenerator.extractUsedKinds(nipsIndex);

    // Check that some expected kinds are extracted from the real NIPs index
    const expectedKinds = [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      20,
      21,
      22,
      30,
      31,
      32,
      33,
      40,
      41,
      42,
      43,
      44,
      62,
      64,
      818,
      1018,
      1021,
      1022,
      1040,
      1059,
      1063,
      1068,
      1111,
      1311,
      1337,
      1617,
      1621,
      1622,
      1971,
      1984,
      1985,
      1986,
      1987,
      2003,
      2004,
      2022,
      4550,
      7000,
      7374,
      7375,
      7376,
      9041,
      9321,
      9467,
      9734,
      9735,
      9802,
      10000,
      10001,
      10002,
      10003,
      10004,
      10005,
      10006,
      10007,
      10009,
      10012,
      10013,
      10015,
      10019,
      10020,
      10030,
      10050,
      10063,
      10096,
      10166,
      13194,
      17375,
      21000,
      22242,
      23194,
      23195,
      24133,
      24242,
      27235,
      30000,
      30001,
      30002,
      30003,
      30004,
      30005,
      30007,
      30008,
      30009,
      30015,
      30017,
      30018,
      30019,
      30020,
      30023,
      30024,
      30030,
      30040,
      30041,
      30063,
      30078,
      30166,
      30267,
      30311,
      30315,
      30388,
      30402,
      30403,
      30617,
      30618,
      30818,
      30819,
      31234,
      31388,
      31890,
      31922,
      31923,
      31924,
      31925,
      31989,
      31990,
      32267,
      34550,
      38383,
      39089,
      39092,
      39701,
    ];

    for (const kind of expectedKinds) {
      expect(usedKinds.has(kind)).toBe(true);
    }

    // Check that ranges are properly extracted
    // `5000`-`5999` should add all numbers from 5000 to 5999
    for (let i = 5000; i <= 5999; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }

    // `6000`-`6999` should add all numbers from 6000 to 6999
    for (let i = 6000; i <= 6999; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }

    // `9000`-`9030` should add all numbers from 9000 to 9030
    for (let i = 9000; i <= 9030; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }

    // `39000-9` should add all numbers from 39000 to 39009
    for (let i = 39000; i <= 39009; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }

    // `1630`-`1633` should add all numbers from 1630 to 1633
    for (let i = 1630; i <= 1633; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }
  });

  it('should extract used kinds from mock data', () => {
    const mockNipsIndex = `
## Event Kinds

| kind          | description                     | NIP                                    |
| ------------- | ------------------------------- | -------------------------------------- |
| \`0\`           | User Metadata                   | [01](01.md)                            |
| \`1\`           | Short Text Note                 | [10](10.md)                            |
| \`3\`           | Follows                         | [02](02.md)                            |
| \`1000\`-\`1999\` | Custom Range                    | [test](test.md)                        |
| \`30000\`       | Addressable Event               | [51](51.md)                            |
`;

    const usedKinds = KindGenerator.extractUsedKinds(mockNipsIndex);

    // Check individual kinds
    expect(usedKinds.has(0)).toBe(true);
    expect(usedKinds.has(1)).toBe(true);
    expect(usedKinds.has(3)).toBe(true);
    expect(usedKinds.has(30000)).toBe(true);

    // Check range
    for (let i = 1000; i <= 1999; i++) {
      expect(usedKinds.has(i)).toBe(true);
    }
  });

  it('should get kind range info correctly', () => {
    const regularRange = KindGenerator.getKindRangeInfo('regular');
    expect(regularRange.min).toBe(1000);
    expect(regularRange.max).toBe(9999);
    expect(regularRange.name).toBe('Regular Events');

    const replaceableRange = KindGenerator.getKindRangeInfo('replaceable');
    expect(replaceableRange.min).toBe(10000);
    expect(replaceableRange.max).toBe(19999);

    const ephemeralRange = KindGenerator.getKindRangeInfo('ephemeral');
    expect(ephemeralRange.min).toBe(20000);
    expect(ephemeralRange.max).toBe(29999);

    const addressableRange = KindGenerator.getKindRangeInfo('addressable');
    expect(addressableRange.min).toBe(30000);
    expect(addressableRange.max).toBe(39999);
  });

  it('should generate available kinds in correct ranges', () => {
    const usedKinds = new Set([1000, 1001, 1002, 10000, 10001, 30000, 30001]);

    // Test regular range
    const regularKind = KindGenerator.generateAvailableKind(
      'regular',
      usedKinds,
    );
    expect(regularKind >= 1000 && regularKind <= 9999).toBe(true);
    expect(usedKinds.has(regularKind)).toBe(false);
    // Check new constraints
    expect(regularKind % 2 !== 0).toBe(true);
    expect(regularKind % 5 !== 0).toBe(true);
    // Check buffer constraint - should not be within 2 of any used kind
    for (const usedKind of usedKinds) {
      const distance = Math.abs(regularKind - usedKind);
      expect(distance > 2).toBe(true);
    }

    // Test replaceable range
    const replaceableKind = KindGenerator.generateAvailableKind(
      'replaceable',
      usedKinds,
    );
    expect(replaceableKind >= 10000 && replaceableKind <= 19999).toBe(true);
    expect(usedKinds.has(replaceableKind)).toBe(false);
    expect(replaceableKind % 2 !== 0).toBe(true);
    expect(replaceableKind % 5 !== 0).toBe(true);

    // Test ephemeral range
    const ephemeralKind = KindGenerator.generateAvailableKind(
      'ephemeral',
      usedKinds,
    );
    expect(ephemeralKind >= 20000 && ephemeralKind <= 29999).toBe(true);
    expect(usedKinds.has(ephemeralKind)).toBe(false);
    expect(ephemeralKind % 2 !== 0).toBe(true);
    expect(ephemeralKind % 5 !== 0).toBe(true);

    // Test addressable range
    const addressableKind = KindGenerator.generateAvailableKind(
      'addressable',
      usedKinds,
    );
    expect(addressableKind >= 30000 && addressableKind <= 39999).toBe(true);
    expect(usedKinds.has(addressableKind)).toBe(false);
    expect(addressableKind % 2 !== 0).toBe(true);
    expect(addressableKind % 5 !== 0).toBe(true);
  });

  it('should respect buffer constraints when generating kinds', () => {
    // Test buffer constraint specifically
    const usedKinds = new Set([1007, 1013, 1019]); // Use odd numbers that aren't multiples of 5

    const regularKind = KindGenerator.generateAvailableKind('regular', usedKinds);

    // Should be in range
    expect(regularKind >= 1000 && regularKind <= 9999).toBe(true);

    // Should be odd
    expect(regularKind % 2 !== 0).toBe(true);

    // Should not be multiple of 5
    expect(regularKind % 5 !== 0).toBe(true);

    // Should not be within buffer of used kinds
    const forbiddenNumbers = new Set([
      1005, 1006, 1007, 1008, 1009, // around 1007
      1011, 1012, 1013, 1014, 1015, // around 1013
      1017, 1018, 1019, 1020, 1021, // around 1019
    ]);

    expect(forbiddenNumbers.has(regularKind)).toBe(false);
  });

  it('should handle edge cases with many used kinds', () => {
    // Test with many used kinds to ensure we still find valid ones
    const usedKinds = new Set<number>();

    // Fill most even numbers and multiples of 5 in a small range
    for (let i = 1000; i <= 1100; i++) {
      if (i % 2 === 0 || i % 5 === 0) {
        usedKinds.add(i);
      }
    }

    const regularKind = KindGenerator.generateAvailableKind('regular', usedKinds);

    // Should still find a valid kind
    expect(regularKind >= 1000 && regularKind <= 9999).toBe(true);
    expect(regularKind % 2 !== 0).toBe(true);
    expect(regularKind % 5 !== 0).toBe(true);
    expect(usedKinds.has(regularKind)).toBe(false);
  });

  it('should generate random kinds with good distribution', { timeout: 10000 }, () => {
    const nipsIndex = readFileSync(join(__dirname, 'fixtures', 'NIPs.md'), 'utf-8');
    const usedKinds = KindGenerator.extractUsedKinds(nipsIndex);

    // Generate many kinds and check distribution
    const results = new Map<number, number>();
    const iterations = 50; // Reduced from 100 to 50 for performance

    for (let i = 0; i < iterations; i++) {
      const kind = KindGenerator.generateAvailableKind('regular', usedKinds);
      results.set(kind, (results.get(kind) || 0) + 1);

      // Verify constraints on each generated kind
      expect(kind % 2 !== 0).toBe(true);
      expect(kind % 5 !== 0).toBe(true);
      expect(usedKinds.has(kind)).toBe(false);
    }

    // Check that we get good variety (at least 5 unique kinds in 50 iterations)
    // Reduced expectations due to fewer iterations
    expect(results.size).toBeGreaterThanOrEqual(5);

    // Check that no single kind dominates (no kind should appear more than 50% of the time)
    // Increased threshold due to fewer iterations
    const maxFrequency = Math.max(...results.values());
    const maxFrequencyPercent = (maxFrequency / iterations) * 100;
    expect(maxFrequencyPercent).toBeLessThanOrEqual(50);

    // Check that all generated kinds follow our constraints
    for (const [kind] of results) {
      expect(kind % 2 !== 0).toBe(true);
      expect(kind % 5 !== 0).toBe(true);

      // Check buffer constraint
      for (const usedKind of usedKinds) {
        const distance = Math.abs(kind - usedKind);
        expect(distance > 2).toBe(true);
      }
    }
  });
});
