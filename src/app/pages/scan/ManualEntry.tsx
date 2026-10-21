// Fallback for cashiers whose camera can't read the QR: type the code printed under it.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';

export default function ManualEntry() {
  const { t } = useT();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '');
    if (clean) navigate(`/m/${encodeURIComponent(clean)}`);
  };

  return (
    <section className="scan-page">
      <div className="container scan-container">
        <form className="join-form scan-card" onSubmit={submit}>
          <span className="scan-icon"><Icon name="qr" /></span>
          <div className="form-head">
            <h1>{t('scan.manualTitle')}</h1>
            <p>{t('scan.manualLead')}</p>
          </div>
          <div className="field">
            <label htmlFor="code">{t('scan.codeLabel')}</label>
            <input
              id="code"
              className="code-input"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block join-submit" type="submit">
            <Icon name="search" />
            {t('scan.check')}
          </button>
        </form>
      </div>
    </section>
  );
}
