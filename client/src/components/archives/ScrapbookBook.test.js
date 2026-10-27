// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import ScrapbookBook from './ScrapbookBook.vue';

const pages = ['cover', 'p1', 'p2', 'p3', 'p4', 'back'].map((id) => ({ id, kind: id }));

function mountBook() {
  return mount(ScrapbookBook, {
    props: { pages },
    slots: { page: ({ page }) => h('span', { class: 'content' }, page.id) },
    attachTo: document.body,
  });
}

function pointer(type, props) {
  const event = new Event(type, { bubbles: true });
  return Object.assign(event, { pointerType: 'mouse', button: 0, pointerId: 1, clientY: 100, ...props });
}

const label = (wrapper) => wrapper.get('.page-label').text();

beforeEach(() => {
  vi.useFakeTimers();
  window.innerWidth = 1024;
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ScrapbookBook', () => {
  it('pairs pages onto two-sided leaves and opens from the closed cover', async () => {
    const wrapper = mountBook();
    const leaves = wrapper.findAll('.leaf');
    expect(leaves).toHaveLength(3);
    expect(leaves[0].get('.front').text()).toBe('cover');
    expect(leaves[0].get('.back').text()).toBe('p1');
    expect(label(wrapper)).toBe('Front cover');
    expect(wrapper.get('.book').attributes('style')).toContain('translateX(-');
    expect(wrapper.get('[aria-label="Previous page"]').attributes('disabled')).toBeDefined();

    await wrapper.get('.open-cover').trigger('click');
    expect(label(wrapper)).toBe('Pages 1–2 of 4');
    expect(wrapper.get('.book').attributes('style')).toContain('translateX(0px)');
    expect(leaves[0].attributes('style')).toContain('rotateY(-180deg)');
    expect(leaves[0].classes()).toContain('turning');
    vi.advanceTimersByTime(1000);
    await nextTick();
    expect(leaves[0].classes()).not.toContain('turning');
    expect(wrapper.find('.open-cover').exists()).toBe(false);
    wrapper.unmount();
  });

  it('turns with the buttons, page corners and arrow keys, and stops at the covers', async () => {
    const wrapper = mountBook();
    await wrapper.get('[aria-label="Next page"]').trigger('click');
    await wrapper.get('.corner-next').trigger('click');
    expect(label(wrapper)).toBe('Pages 3–4 of 4');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await nextTick();
    expect(label(wrapper)).toBe('Back cover');
    expect(wrapper.get('[aria-label="Next page"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.corner-next').exists()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await nextTick();
    await wrapper.get('.corner-prev').trigger('click');
    expect(label(wrapper)).toBe('Pages 1–2 of 4');

    await wrapper.get('.close-book').trigger('click');
    expect(label(wrapper)).toBe('Front cover');
    wrapper.unmount();
  });

  it('follows a drag and only turns the page when it is dragged far enough', async () => {
    const wrapper = mountBook();
    const stage = wrapper.get('.stage').element;
    await wrapper.get('.open-cover').trigger('click');

    stage.dispatchEvent(pointer('pointerdown', { clientX: 900 }));
    stage.dispatchEvent(pointer('pointermove', { clientX: 860 }));
    await nextTick();
    const leaf = wrapper.findAll('.leaf')[1];
    expect(leaf.attributes('style')).toContain('transition: none');
    expect(leaf.attributes('style')).toMatch(/rotateY\(-\d/);
    stage.dispatchEvent(pointer('pointerup', { clientX: 860 }));
    await nextTick();
    expect(label(wrapper)).toBe('Pages 1–2 of 4');

    stage.dispatchEvent(pointer('pointerdown', { clientX: 900 }));
    stage.dispatchEvent(pointer('pointermove', { clientX: 500 }));
    stage.dispatchEvent(pointer('pointerup', { clientX: 500 }));
    await nextTick();
    expect(label(wrapper)).toBe('Pages 3–4 of 4');

    // dragging the other way turns back
    stage.dispatchEvent(pointer('pointerdown', { clientX: 300 }));
    stage.dispatchEvent(pointer('pointermove', { clientX: 700 }));
    stage.dispatchEvent(pointer('pointerup', { clientX: 700 }));
    await nextTick();
    expect(label(wrapper)).toBe('Pages 1–2 of 4');
    wrapper.unmount();
  });

  it('leaves vertical swipes alone so the page can still scroll', async () => {
    const wrapper = mountBook();
    const stage = wrapper.get('.stage').element;
    await wrapper.get('.open-cover').trigger('click');
    stage.dispatchEvent(pointer('pointerdown', { clientX: 900, clientY: 100 }));
    stage.dispatchEvent(pointer('pointermove', { clientX: 895, clientY: 300 }));
    stage.dispatchEvent(pointer('pointermove', { clientX: 500, clientY: 320 }));
    stage.dispatchEvent(pointer('pointerup', { clientX: 500, clientY: 320 }));
    await nextTick();
    expect(label(wrapper)).toBe('Pages 1–2 of 4');
    wrapper.unmount();
  });

  it('shows one page at a time on narrow screens and keeps the last page on screen', async () => {
    window.innerWidth = 375;
    const wrapper = mountBook();
    expect(wrapper.findAll('.leaf')).toHaveLength(6);
    expect(wrapper.get('.book').classes()).toContain('single');
    await wrapper.get('.open-cover').trigger('click');
    await wrapper.get('[aria-label="Next page"]').trigger('click');
    expect(label(wrapper)).toBe('Page 2 of 4');

    for (let i = 0; i < 5; i++) await wrapper.get('[aria-label="Next page"]').trigger('click');
    expect(label(wrapper)).toBe('Back cover');
    wrapper.unmount();
  });
});
