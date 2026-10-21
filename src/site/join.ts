// "Dasman Members" join form: creates the member account in Supabase (the profile is filled
// from the sign-up metadata by a database trigger) and shows the live member counter.
const form = document.getElementById('joinForm') as HTMLFormElement | null;

if (form) {
  const isArabic = document.documentElement.lang === 'ar';
  const messages = isArabic
    ? {
        success: 'تم إنشاء حسابك! أرسلنا رابط التفعيل إلى بريدك الإلكتروني، افتحه لتفعيل عضويتك.',
        exists: 'هذا البريد مسجّل لدينا مسبقًا. سجّل الدخول من صفحة الدخول.',
        weak: 'كلمة المرور ضعيفة، اختر كلمة أطول (8 أحرف على الأقل).',
        rate: 'محاولات كثيرة، الرجاء المحاولة بعد قليل.',
        error: 'تعذّر إنشاء الحساب، الرجاء المحاولة مرة أخرى.',
      }
    : {
        success: 'Your account is created! We sent an activation link to your email. Open it to activate your membership.',
        exists: 'This email is already registered. Please log in instead.',
        weak: 'This password is too weak. Choose a longer one (at least 8 characters).',
        rate: 'Too many attempts. Please try again in a moment.',
        error: "We couldn't create your account. Please try again.",
      };

  const submitButton = form.querySelector<HTMLButtonElement>('.join-submit')!;
  const statusBox = form.querySelector<HTMLElement>('.form-status')!;
  const password2 = form.elements.namedItem('password2') as HTMLInputElement;
  const loadSupabase = () => import('../lib/supabase').then((m) => m.supabase);

  // ---------- Registered-members counter ----------
  const counterBox = document.querySelector<HTMLElement>('.member-counter');
  const counterNumber = counterBox?.querySelector<HTMLElement>('[data-count]');
  let memberCount: number | null = null;

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

  function bumpCounter() {
    if (memberCount === null || !counterBox || !counterNumber) return;
    memberCount += 1;
    counterNumber.textContent = formatNumber(memberCount);
    counterBox.classList.remove('is-bumped');
    void counterBox.offsetWidth; // restart the CSS animation
    counterBox.classList.add('is-bumped');
  }

  if (counterBox && counterNumber) {
    loadSupabase()
      .then((supabase) => supabase.rpc('public_member_count'))
      .then(({ data, error }) => {
        if (error) throw error;
        memberCount = data ?? 0;
        counterBox.hidden = false;
        whenVisible(counterBox, () => countUp(memberCount!));
      })
      .catch((err) => console.warn('Member counter unavailable:', err));
  }

  // ---------- Form submission ----------
  function showStatus(type: 'success' | 'error', message: string) {
    statusBox.className = 'form-status is-' + type;
    statusBox.textContent = message;
  }

  function setLoading(isLoading: boolean) {
    form!.classList.toggle('is-loading', isLoading);
    submitButton.disabled = isLoading;
  }

  const value = (name: string) => (form!.elements.namedItem(name) as HTMLInputElement).value.trim();

  password2.addEventListener('input', () => password2.setCustomValidity(''));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusBox.className = 'form-status';
    statusBox.textContent = '';

    password2.setCustomValidity(value('password2') && value('password2') !== value('password') ? 'mismatch' : '');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      form.querySelector<HTMLElement>(':invalid')?.focus();
      return;
    }

    // Honeypot: bots tick the hidden checkbox; pretend success without creating anything.
    if ((form.elements.namedItem('botcheck') as HTMLInputElement).checked) {
      showStatus('success', messages.success);
      return;
    }

    setLoading(true);
    try {
      const supabase = await loadSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: value('email'),
        password: (form.elements.namedItem('password') as HTMLInputElement).value,
        options: {
          emailRedirectTo: `${location.origin}/account`,
          data: {
            full_name: value('name'),
            university: value('university'),
            study_year: value('year'),
            district: value('district'),
            phone: value('phone'),
            notes: value('notes'),
            lang: isArabic ? 'ar' : 'en',
          },
        },
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === 'user_already_exists' || code === 'email_exists') showStatus('error', messages.exists);
        else if (code === 'weak_password') showStatus('error', messages.weak);
        else if (error.status === 429) showStatus('error', messages.rate);
        else throw error;
        return;
      }
      // With email confirmation on, an existing address returns a user without identities.
      if (data.user && data.user.identities?.length === 0) {
        showStatus('error', messages.exists);
        return;
      }
      form.reset();
      form.classList.remove('was-validated');
      showStatus('success', messages.success);
      bumpCounter();
    } catch (err) {
      console.error('Join form:', err);
      showStatus('error', messages.error);
    } finally {
      setLoading(false);
    }
  });
}
