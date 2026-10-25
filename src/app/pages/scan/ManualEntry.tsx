// Fallback for cashiers whose camera can't read the QR: type the code printed under it.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/Field';

export default function ManualEntry() {
  const { t } = useT();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{6,20}$/.test(clean)) return setError(t('scan.err.invalid_member'));
    navigate(`/m/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="container page scan">
      <motion.form className="surface scan-entry" onSubmit={submit} noValidate initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="scan-entry-icon">
          <Icon name="qr" />
        </span>
        <h1>{t('scan.manualTitle')}</h1>
        <p>{t('scan.manualLead')}</p>
        <TextField
          label={t('scan.codeLabel')}
          icon="hash"
          className="mono code-input"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
          placeholder={t('scan.codePh')}
          value={code}
          error={error}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
        />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!code.trim()}>
          <Icon name="search" />
          {t('scan.check')}
        </button>
        <div className="scan-tip">
          <Icon name="sparkle" />
          <div>
            <strong>{t('scan.tipTitle')}</strong>
            <p>{t('scan.tip')}</p>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
