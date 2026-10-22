// "Dasman Members" section: live registered-members counter. Sign-up itself lives at /register.
const counterBox = document.querySelector<HTMLElement>('.member-counter');
const counterNumber = counterBox?.querySelector<HTMLElement>('[data-count]');

const formatNumber = (n: number) => n.toLocaleString('en-US');

function whenVisible(element: Element, callback: () => void) {
  if (!('IntersectionObserver' in window)) return callback();
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        callback();
      }
    },
    { threshold: 0.4 },
  );
  observer.observe(element);
}

function countUp(target: number) {
  if (!counterNumber) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counterNumber.textContent = formatNumber(target);
    return;
  }
  const duration = 1600;
  let start: number | null = null;
  function step(time: number) {
    if (start === null) start = time;
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    counterNumber!.textContent = formatNumber(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

if (counterBox && counterNumber) {
  import('../lib/supabase')
    .then(({ supabase }) => supabase.rpc('public_member_count'))
    .then(({ data, error }) => {
      if (error) throw error;
      const count = data ?? 0;
      counterBox.hidden = false;
      whenVisible(counterBox, () => countUp(count));
    })
    .catch((err) => console.warn('Member counter unavailable:', err));
}
