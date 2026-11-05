// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TalesView from './TalesView.vue';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, assetUrl: (u) => u, errorMessage: () => 'error' }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ options: { history: { state: {} } }, replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'me' }, profile: null, isLoggedIn: true }) }));

const post = (id, fields) => ({ id, caption: 'x', images: [], created_at: '2026-11-01T00:00:00Z', likeCount: 0, commentCount: 0, ...fields });

async function moreLinks(items) {
  api.get.mockResolvedValue({ data: { items, nextCursor: null } });
  const wrapper = mount(TalesView, {
    global: {
      stubs: {
        FiresideCircle: true,
        RouterLink: { props: ['to'], template: '<a class="stub-link" :data-to="to"><slot /></a>' },
        Teleport: true,
      },
    },
  });
  await flushPromises();
  return wrapper.findAll('a.stub-link').filter((a) => a.text() === 'More here').map((a) => a.attributes('data-to'));
}

describe('Tales "More here"', () => {
  it('opens the same page as "View place" in the Explorer when the place is on Google', async () => {
    expect(await moreLinks([post('1', { place: { id: 'p1', google_place_id: 'g/1', name: 'Cafe' } })])).toEqual([
      '/explorer/place/g%2F1',
    ]);
  });

  it("falls back to the tales page for places with no Google page", async () => {
    expect(
      await moreLinks([
        post('1', { place: { id: 'p1', google_place_id: null, name: 'Curated' } }),
        post('2', { place: null, custom_place_name: 'Kyoto' }),
      ]),
    ).toEqual(['/explorer/tales/place/p1', '/explorer/tales/custom/Kyoto']);
  });
});
