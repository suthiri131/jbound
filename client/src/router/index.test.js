// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import router from './index';

vi.mock('@/lib/supabase', () => ({ supabase: null, hasSupabase: false }));

const sources = import.meta.glob('../**/*.vue', { eager: true, query: '?raw', import: 'default' });

describe('application navigation after planner rename', () => {
  it('resolves internal link literals and representative dynamic links', () => {
    const targets = new Set([
      '/planner', '/planner?new=1', '/planner?join=invite-code',
      '/planner/example-trip?search=Kyoto&phase=planning',
      '/archives/example-trip', '/explorer?pinTo=example-trip',
      '/tales/place/example-place', '/tales/custom/Kyoto',
    ]);
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(/(?:to|path|linkTo)\s*[:=]\s*["'](\/[^"']*)["']/g)) {
        targets.add(match[1]);
      }
      for (const match of source.matchAll(/router\.(?:push|replace)\(["'](\/[^"']*)["']\)/g)) {
        targets.add(match[1]);
      }
    }
    for (const target of targets) {
      expect(router.resolve(target).matched.length, target).toBeGreaterThan(0);
    }
    expect(router.resolve('/planner/example-trip').params.tripId).toBe('example-trip');
    expect(router.resolve({ name: 'planner' }).path).toBe('/planner');
    expect(router.resolve({ name: 'trip-details', params: { tripId: 'example-trip' } }).path).toBe('/planner/example-trip');
  });

  it('loads every registered page and the correct renamed planner views', async () => {
    for (const route of router.getRoutes()) {
      if (typeof route.components?.default === 'function') {
        const page = await route.components.default();
        expect(page.default, route.path).toBeTruthy();
        if (route.path === '/planner') expect(page.default.__name).toBe('PlannerView');
        if (route.path === '/planner/:tripId') expect(page.default.__name).toBe('PlannerDetailsView');
      }
    }
  });
});
