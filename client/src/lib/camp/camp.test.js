import { describe, expect, it } from 'vitest';
import { daylightAt, environmentFor, phaseAt, sgHours } from './environment';
import { DEFAULT_LOOK, lookFromId, normaliseLook } from './avatar';

describe('camp environment', () => {
  it('reads the clock in Singapore time, not the visitor’s', () => {
    expect(sgHours(new Date('2026-10-31T04:30:00Z'))).toBe(12.5); // 12:30pm SGT
    expect(sgHours(new Date('2026-10-31T16:00:00Z'))).toBe(0);
  });

  it('is night after sunset and day at noon', () => {
    expect(daylightAt(12)).toBe(1);
    expect(daylightAt(23)).toBe(0);
    expect(phaseAt(7)).toBe('dawn');
    expect(phaseAt(19.2)).toBe('dusk');
  });

  it('lets the visitor pin day or night', () => {
    expect(environmentFor({ hours: 23, mode: 'day' }).night).toBe(false);
    expect(environmentFor({ hours: 12, mode: 'night' }).night).toBe(true);
  });

  it('turns showers and storms into rain', () => {
    expect(environmentFor({ hours: 12, condition: 'rain' }).rain).toBe(true);
    expect(environmentFor({ hours: 12, condition: 'storm' }).storm).toBe(true);
    expect(environmentFor({ hours: 12, condition: 'clear' }).rain).toBe(false);
  });
});

describe('camp avatar looks', () => {
  it('falls back to the default for missing or junk values', () => {
    expect(normaliseLook(null)).toEqual(DEFAULT_LOOK);
    expect(normaliseLook({ skin: 'red', hat: 'crown', top: '#123abc' })).toEqual({ ...DEFAULT_LOOK, top: '#123abc' });
  });

  it('gives each crewmate without a look a stable, valid one', () => {
    expect(lookFromId('abc')).toEqual(lookFromId('abc'));
    expect(normaliseLook(lookFromId('xyz'))).toEqual(lookFromId('xyz'));
  });
});
