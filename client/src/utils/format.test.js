import { describe, expect, it } from 'vitest';
import { shortDate, longDate, dateRange, dayLabel } from './format';

describe('trip date formatting', () => {
  it('renders dated trip covers and headings', () => {
    expect(shortDate('2026-10-16')).toBe('Fri 16 Oct');
    expect(longDate('2026-10-16')).toBe('Friday 16 Oct');
    expect(dateRange('2026-10-16', '2026-10-17')).toBe('Fri 16 Oct – Sat 17 Oct');
    expect(dateRange('2026-10-16', '2026-10-16')).toBe('Fri 16 Oct');
  });

  it('handles undated trips and itinerary day labels', () => {
    expect(dateRange(null, null)).toBe('No dates yet');
    expect(dayLabel('2026-10-16', '2026-10-17')).toBe('Day 2');
    expect(dayLabel(null, '2026-10-16')).toBe('Fri 16 Oct');
    expect(dayLabel('2026-10-16', null)).toBe('Unscheduled');
  });
});
