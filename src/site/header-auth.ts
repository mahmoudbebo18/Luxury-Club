// "Login" in the header and drawer becomes "My account" when a Supabase session is stored, and
// the sign-up links disappear for signed-in members. Reads localStorage only, so the
// marketing pages never load the Supabase client for this.
const hasSession = (() => {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  } catch {
    return false;
  }
})();

document.querySelectorAll<HTMLAnchorElement>('[data-auth-link]').forEach((a) => {
  a.href = hasSession ? '/account' : '/login';
  const label = a.querySelector('span') ?? a;
  label.textContent = (hasSession ? a.dataset.labelIn : a.dataset.labelOut) ?? label.textContent;
});

if (hasSession) {
  // The join card leads to the account instead of sign-up.
  document.querySelectorAll<HTMLAnchorElement>('.join-cta a[href^="/register"]').forEach((a) => {
    a.href = '/account';
    const text = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
    if (text) text.textContent = document.documentElement.lang === 'ar' ? 'حسابي' : 'My account';
    a.closest('.join-cta')?.querySelector('.form-alt')?.remove();
  });
  // Every other sign-up link ("Register now", "Join us", the hero and privileges buttons) is for
  // visitors only: a member has already joined. Footer links take their list item with them, and
  // the services page's join band has nothing left to offer without its button.
  document.querySelectorAll<HTMLElement>('a[href^="/register"]').forEach((a) => {
    (a.closest('.footer-links li') ?? a.closest('.cta-wrap') ?? a).remove();
  });
  // "Join us" in the header and drawer scrolls to the members section, which only invites sign-up.
  document.querySelectorAll<HTMLElement>('.main-nav a[href$="#join"], .drawer-nav a[href$="#join"]').forEach((a) => a.remove());
}

if (hasSession) {
  // Services page: each service gets a button to request it from the member's services page
  // (activities already has its own button).
  const en = document.documentElement.lang === 'en';
  document.querySelectorAll<HTMLElement>('.service-row[id]').forEach((row) => {
    const body = row.querySelector('.service-row-body');
    if (!body || body.querySelector('.service-row-cta')) return;
    const a = document.createElement('a');
    a.className = 'btn btn-primary service-row-cta';
    a.href = `/account/services${en ? '?lang=en' : ''}#${row.id}`;
    a.innerHTML = `${en ? 'Request this service' : 'اطلب الخدمة'}<svg class="icon icon-flip" aria-hidden="true"><use href="/imgs/icons.svg#i-arrow" /></svg>`;
    body.append(a);
  });
}
