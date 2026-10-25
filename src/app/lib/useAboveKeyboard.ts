// Keeps an element (the form's submit button) in sight above the on-screen keyboard.
// Mobile keyboards only shrink the visual viewport, so the page can't tell the button is
// covered; this pads the page by the keyboard height and scrolls the button back into view.
import { useEffect, type RefObject } from 'react';

export function useAboveKeyboard(target: RefObject<HTMLButtonElement>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let timer = 0;

    const update = () => {
      const keyboard = Math.max(0, Math.round(window.innerHeight - vv.height));
      root.style.setProperty('--kb-inset', `${keyboard}px`);
      const el = target.current;
      if (keyboard < 80 || !el || !el.form?.contains(document.activeElement)) return;
      const overlap = el.getBoundingClientRect().bottom + 12 - (vv.offsetTop + vv.height);
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
    };
    // Let the browser finish its own scroll-to-field before measuring.
    const later = () => {
      clearTimeout(timer);
      timer = window.setTimeout(update, 300);
    };

    vv.addEventListener('resize', later);
    document.addEventListener('focusin', later);
    return () => {
      clearTimeout(timer);
      vv.removeEventListener('resize', later);
      document.removeEventListener('focusin', later);
      root.style.removeProperty('--kb-inset');
    };
  }, [target]);
}
