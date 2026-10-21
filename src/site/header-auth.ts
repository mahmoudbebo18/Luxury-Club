// "Login" in the header and drawer becomes "My account" when a Supabase session is stored.
// Reads localStorage only, so the marketing pages never load the Supabase client for this.
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
