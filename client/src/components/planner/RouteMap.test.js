// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { api } from '@/lib/api';

const maps = vi.hoisted(() => ({
  loadGoogleMaps: vi.fn(),
  polylines: [],
  markers: [],
  infoWindows: [],
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  errorMessage: (_error, fallback) => fallback,
}));
vi.mock('@/lib/googleMaps', () => ({
  hasGoogleMaps: true,
  loadGoogleMaps: maps.loadGoogleMaps,
  MAP_ID: 'test-map-id',
}));

import RouteMap from './RouteMap.vue';

const trip = {
  id: 'trip-1',
  start_date: '2026-10-23',
  itinerary: [
    { id: 'stop-1', title: 'Bazaar Karat Night Market', day: '2026-10-23', dwell_minutes: 20 },
    { id: 'stop-2', title: 'Glass Temple', day: '2026-10-23', dwell_minutes: 35 },
  ],
};

beforeEach(() => {
  maps.polylines.length = 0;
  maps.markers.length = 0;
  maps.infoWindows.length = 0;
  maps.loadGoogleMaps.mockResolvedValue({
    Map: class {
      fitBounds() {}
      setCenter() {}
      setZoom() {}
    },
    Polyline: class {
      constructor(options) {
        this.options = options;
        maps.polylines.push(this);
      }
      setMap() {}
    },
    AdvancedMarkerElement: class {
      constructor(options) {
        Object.assign(this, options);
        maps.markers.push(this);
      }
    },
    LatLngBounds: class {
      extend() {}
    },
    InfoWindow: class {
      constructor() {
        maps.infoWindows.push(this);
      }
      setContent(content) {
        this.content = content;
      }
      open(options) {
        this.options = options;
      }
      close() {
        this.closeCalls = (this.closeCalls || 0) + 1;
      }
    },
    SymbolPath: { FORWARD_CLOSED_ARROW: 'forward-closed-arrow' },
  });
  api.get.mockResolvedValue({
    data: {
      stops: [
        { id: 'stop-1', title: 'Bazaar Karat Night Market', lat: 1.46, lng: 103.75 },
        { id: 'stop-2', title: 'Glass Temple', lat: 1.47, lng: 103.76 },
      ],
      route: {
        distanceKm: 2.5,
        durationMin: 3,
        note: 'Driving estimate.',
        latlngs: [[1.46, 103.75], [1.47, 103.76]],
        legs: [{ distanceKm: 2.5, durationMin: 3 }],
      },
    },
  });
});

describe('RouteMap itinerary', () => {
  it('shows per-leg timing, stop buffers, directional arrows, and leg details', async () => {
    const wrapper = mount(RouteMap, { props: { trip } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('Origin');
    expect(wrapper.text()).toContain('Stop 1');
    expect(wrapper.text()).toContain('2.5 km · 3 min driving');
    expect(wrapper.text()).toContain('Drive · 3 min');
    expect(wrapper.text()).toContain('Stop buffers · 55 min');

    const arrow = maps.polylines[1].options.icons.find(
      ({ icon }) => icon.path === 'forward-closed-arrow',
    );
    expect(arrow).toMatchObject({ offset: '50px', repeat: '110px' });

    maps.markers[1].content.dispatchEvent(new Event('mouseenter'));
    expect(maps.infoWindows[0].content.textContent).toContain('Leg 1: 3 min driving (2.5 km)');
    const closeCalls = maps.infoWindows[0].closeCalls;
    maps.markers[1].content.dispatchEvent(new Event('click'));
    maps.markers[1].content.dispatchEvent(new Event('mouseleave'));
    expect(maps.infoWindows[0].closeCalls).toBe(closeCalls);

    wrapper.unmount();
  });
});
