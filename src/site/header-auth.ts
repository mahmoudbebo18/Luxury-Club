// "Login" in the header and drawer becomes "My account" when a Supabase session is stored, and
// "Register now" leads signed-in members to their account. Reads localStorage only, so the
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
  // Header and drawer already show "My account": drop the duplicate "Register now".
  document.querySelectorAll<HTMLElement>('.header-cta, .drawer a[href^="/register"]').forEach((a) => a.remove());
  // "Join us" in the header, drawer and footer: a member has already joined.
  document.querySelectorAll<HTMLElement>('.main-nav a[href$="#join"], .drawer-nav a[href$="#join"]').forEach((a) => a.remove());
  document.querySelectorAll<HTMLElement>('.footer-links a[href$="#join"]').forEach((a) => a.closest('li')?.remove());
  // The join card leads to the account instead of sign-up.
  document.querySelectorAll<HTMLAnchorElement>('.join-cta a[href^="/register"]').forEach((a) => {
    a.href = '/account';
    const text = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
    if (text) text.textContent = document.documentElement.lang === 'ar' ? 'حسابي' : 'My account';
    a.closest('.join-cta')?.querySelector('.form-alt')?.remove();
  });
}
