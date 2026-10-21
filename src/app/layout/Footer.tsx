// Compact version of the site footer (same classes) for platform pages.
import { useT } from '../i18n';
import { Icon } from '../components/Icon';

export function Footer() {
  const { t, lang } = useT();
  const home = lang === 'en' ? '/index-en.html' : '/';
  return (
    <footer className="site-footer site-footer--compact">
      <div className="container footer-bottom">
        <p>
          © {new Date().getFullYear()} {lang === 'ar' ? 'دسمان' : 'DASMAN'} · <span className="nowrap">The Luxury Club</span>
        </p>
        <div className="footer-mini-links">
          <a href={home}>{t('common.home')}</a>
          <a href="https://wa.me/966558103228" target="_blank" rel="noopener">
            <Icon name="whatsapp" />
            WhatsApp
          </a>
          <a href="https://www.instagram.com/dasman_sa" target="_blank" rel="noopener">
            <Icon name="instagram" />
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
