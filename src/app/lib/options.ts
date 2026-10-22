// Registration choices. Stored values are the Arabic labels.
export const STUDY_YEARS: { value: string; en: string }[] = [
  { value: 'السنة الأولى', en: '1st year' },
  { value: 'السنة الثانية', en: '2nd year' },
  { value: 'السنة الثالثة', en: '3rd year' },
  { value: 'السنة الرابعة', en: '4th year' },
  { value: 'السنة الخامسة', en: '5th year' },
  { value: 'السنة السادسة', en: '6th year' },
  { value: 'سنة الامتياز', en: 'Internship year' },
  { value: 'دراسات عليا', en: 'Postgraduate' },
  { value: 'أخرى', en: 'Other' },
];

export const UNIVERSITIES = [
  'جامعة الملك سعود',
  'جامعة رياض العلم',
  'جامعة دار العلوم',
  'جامعة الفيصل',
  'جامعة الإمام محمد بن سعود الإسلامية',
  'جامعة الأميرة نورة بنت عبدالرحمن',
  'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية',
  'جامعة الأمير سلطان',
  'جامعة اليمامة',
  'جامعة المعرفة',
];

/** Saudi / Kuwaiti mobiles and other international numbers: 9–15 digits, optional leading +. */
export const PHONE_RE = /^\+?\d{9,15}$/;
export const cleanPhone = (v: string) => v.replace(/[\s()-]/g, '');

/** Password rule shared by sign-up, reset and change password (also enforced by Supabase Auth). */
export const passwordChecks = (p: string) => ({
  length: p.length >= 8,
  letter: /[A-Za-z]/.test(p),
  number: /\d/.test(p),
});

export function passwordScore(p: string) {
  if (!p) return 0;
  const c = passwordChecks(p);
  let s = (c.length ? 1 : 0) + (c.letter && c.number ? 1 : 0);
  if (p.length >= 12) s += 1;
  if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s += 1;
  return Math.min(4, s);
}
