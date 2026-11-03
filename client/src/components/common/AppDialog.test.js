// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AppDialog from './AppDialog.vue';
import { askConfirm, dismissDialogs, showAlert } from '@/lib/dialog';

const box = () => document.querySelector('[role="alertdialog"]');
const button = (label) => [...box().querySelectorAll('button')].find((b) => b.textContent.includes(label));
const press = (key) => box().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('AppDialog', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = mount(AppDialog, { attachTo: document.body });
  });
  afterEach(() => {
    dismissDialogs();
    wrapper.unmount();
  });

  it('shows the question and resolves true on confirm', async () => {
    const answer = askConfirm({ title: 'Delete this tale?', message: 'For good.', confirmLabel: 'Delete tale', danger: true });
    await flushPromises();
    expect(box().textContent).toContain('Delete this tale?');
    expect(box().textContent).toContain('For good.');
    button('Delete tale').click();
    expect(await answer).toBe(true);
    await flushPromises();
    expect(box()).toBeNull();
  });

  it('starts on Cancel, so a stray Enter cannot confirm', async () => {
    askConfirm({ title: 'Sure?', confirmLabel: 'Yes' });
    await flushPromises();
    expect(document.activeElement.textContent).toContain('Cancel');
  });

  it('resolves false on Cancel, Esc and clicking outside', async () => {
    let answer = askConfirm({ title: 'One' });
    await flushPromises();
    button('Cancel').click();
    expect(await answer).toBe(false);

    answer = askConfirm({ title: 'Two' });
    await flushPromises();
    press('Escape');
    expect(await answer).toBe(false);

    answer = askConfirm({ title: 'Three' });
    await flushPromises();
    document.querySelector('.app-dialog-scrim').click();
    expect(await answer).toBe(false);
  });

  it('shows notices with a single button', async () => {
    const done = showAlert('Could not post that.');
    await flushPromises();
    expect(box().textContent).toContain('Something went wrong');
    expect(box().textContent).toContain('Could not post that.');
    expect(box().querySelectorAll('button')).toHaveLength(1);
    button('OK').click();
    await done;
  });

  it('shows popups one at a time, in order', async () => {
    const first = askConfirm({ title: 'First' });
    const second = askConfirm({ title: 'Second' });
    await flushPromises();
    expect(box().textContent).toContain('First');
    button('OK').click();
    expect(await first).toBe(true);
    await flushPromises();
    expect(box().textContent).toContain('Second');
    button('Cancel').click();
    expect(await second).toBe(false);
  });

  it('answers no to everything when dismissed', async () => {
    const answers = [askConfirm({ title: 'A' }), askConfirm({ title: 'B' })];
    dismissDialogs();
    expect(await Promise.all(answers)).toEqual([false, false]);
    await flushPromises();
    expect(box()).toBeNull();
  });
});
