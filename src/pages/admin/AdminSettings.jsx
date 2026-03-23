import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LoadingState from '../../components/LoadingState.jsx';

const NAMECHEAP_SMTP_HOST = 'mail.privateemail.com';
const NAMECHEAP_SMTP_PORT_SSL = '465';
const NAMECHEAP_SMTP_PORT_STARTTLS = '587';

const defaultSettings = {
  storeName: 'PS5 Controller',
  adminEmail: '',
  supportEmail: '',
  supportPhone: '',
  defaultCurrency: 'BHD',
  orderPrefix: 'ORD',
  invoicePrefix: 'INV',
  trackingBaseUrl: '',
  websiteBaseUrl: '',
  logoUrl: '',
  instagramUrl: 'https://www.instagram.com/fhonelstore/?hl=en',
  tiktokUrl: '',
  facebookUrl: '',
  smtpHost: NAMECHEAP_SMTP_HOST,
  smtpPort: NAMECHEAP_SMTP_PORT_SSL,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpFromName: '',
  tapPublicKey: ''
};

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#e6edf3'
};

const sectionStyle = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '1rem'
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return emailPattern.test(String(value || '').trim());
}

function normalizeSmtpPort(value) {
  const trimmed = String(value || '').trim();
  return trimmed === NAMECHEAP_SMTP_PORT_STARTTLS ? NAMECHEAP_SMTP_PORT_STARTTLS : NAMECHEAP_SMTP_PORT_SSL;
}

function normalizeNamecheapSmtpForm(formData) {
  const smtpPort = normalizeSmtpPort(formData.smtpPort);
  const smtpSecure = smtpPort === NAMECHEAP_SMTP_PORT_SSL;
  const smtpUser = String(formData.smtpUser || '').trim().toLowerCase();
  const smtpFromEmail = String(formData.smtpFromEmail || smtpUser).trim().toLowerCase();
  const smtpFromName = String(formData.smtpFromName || formData.storeName || 'Custom Controller').trim();

  return {
    ...formData,
    smtpHost: NAMECHEAP_SMTP_HOST,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpFromEmail,
    smtpFromName
  };
}

function validateNamecheapSmtpForm(formData, hasStoredSmtpPass) {
  const normalized = normalizeNamecheapSmtpForm(formData);

  if (!normalized.smtpUser) {
    return 'SMTP user is required.';
  }

  if (!isValidEmail(normalized.smtpUser)) {
    return 'SMTP user must be a valid full email address.';
  }

  if (!normalized.smtpFromEmail) {
    return 'From email is required.';
  }

  if (!isValidEmail(normalized.smtpFromEmail)) {
    return 'From email must be a valid email address.';
  }

  if (!String(formData.smtpPass || '').trim() && !hasStoredSmtpPass) {
    return 'SMTP password is required.';
  }

  if (!normalized.smtpFromName) {
    return 'From name is required.';
  }

  return '';
}

const AdminSettings = () => {
  const [formData, setFormData] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [hasStoredSmtpPass, setHasStoredSmtpPass] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'admin_settings', 'general'));
        if (snapshot.exists()) {
          const data = snapshot.data() || {};
          setHasStoredSmtpPass(Boolean(data.smtpPass));
          setFormData({
            ...defaultSettings,
            ...data,
            smtpHost: String(data.smtpHost || NAMECHEAP_SMTP_HOST).trim() || NAMECHEAP_SMTP_HOST,
            smtpPort: normalizeSmtpPort(data.smtpPort),
            smtpSecure: normalizeSmtpPort(data.smtpPort) === NAMECHEAP_SMTP_PORT_SSL,
            smtpPass: ''
          });
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      }
      setLoading(false);
    };
    run();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (type === 'checkbox') {
      setFormData((current) => ({ ...current, [name]: checked }));
      return;
    }
    if (name === 'smtpPort') {
      const smtpPort = normalizeSmtpPort(value);
      setFormData((current) => ({
        ...current,
        smtpPort,
        smtpSecure: smtpPort === NAMECHEAP_SMTP_PORT_SSL
      }));
      return;
    }
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setMessageTone('success');
    try {
      const validationError = validateNamecheapSmtpForm(formData, hasStoredSmtpPass);
      if (validationError) {
        setMessage(validationError);
        setMessageTone('error');
        setSaving(false);
        return;
      }

      const normalizedSmtp = normalizeNamecheapSmtpForm(formData);
      const nextPayload = {
        ...normalizedSmtp,
        updatedAt: new Date()
      };

      if (!String(formData.smtpPass || '').trim()) {
        delete nextPayload.smtpPass;
      }

      await setDoc(
        doc(db, 'admin_settings', 'general'),
        nextPayload,
        { merge: true }
      );
      setHasStoredSmtpPass(hasStoredSmtpPass || Boolean(String(formData.smtpPass || '').trim()));
      setFormData((current) => ({ ...current, smtpPass: '' }));
      setMessage('Settings saved.');
      setMessageTone('success');
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage('Failed to save settings.');
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading settings..." minHeight="32vh" />;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={sectionStyle}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>General Settings</div>
        <div style={{ marginTop: '0.35rem', color: '#8b949e' }}>
          Store-wide values for orders, email notifications, tracking links, and SMTP delivery.
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: '1rem' }}
      >
        <section style={sectionStyle}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>Store & Order Settings</div>
            <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
              Customer-facing store info, order labels, and tracking URLs.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Store Name</span>
              <input name="storeName" value={formData.storeName} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Admin Email</span>
              <input name="adminEmail" value={formData.adminEmail} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Support Email</span>
              <input name="supportEmail" value={formData.supportEmail} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Support Phone</span>
              <input name="supportPhone" value={formData.supportPhone} onChange={handleChange} style={fieldStyle} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Default Currency</span>
              <input name="defaultCurrency" value={formData.defaultCurrency} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Order Prefix</span>
              <input name="orderPrefix" value={formData.orderPrefix} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Invoice Prefix</span>
              <input name="invoicePrefix" value={formData.invoicePrefix} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Tap Public Key</span>
              <input name="tapPublicKey" value={formData.tapPublicKey} onChange={handleChange} style={fieldStyle} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Website Base URL</span>
              <input
                name="websiteBaseUrl"
                value={formData.websiteBaseUrl}
                onChange={handleChange}
                placeholder="https://customcontroller.co"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Logo URL</span>
              <input
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                placeholder="https://customcontroller.co/assets/logo.png"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Tracking Base URL</span>
              <input
                name="trackingBaseUrl"
                value={formData.trackingBaseUrl}
                onChange={handleChange}
                placeholder="https://carrier.example/track?code={trackingNumber}"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Instagram URL</span>
              <input
                name="instagramUrl"
                value={formData.instagramUrl}
                onChange={handleChange}
                placeholder="https://www.instagram.com/yourstore"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>TikTok URL</span>
              <input
                name="tiktokUrl"
                value={formData.tiktokUrl}
                onChange={handleChange}
                placeholder="https://www.tiktok.com/@yourstore"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>Facebook URL</span>
              <input
                name="facebookUrl"
                value={formData.facebookUrl}
                onChange={handleChange}
                placeholder="https://www.facebook.com/yourstore"
                style={fieldStyle}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>SMTP & Email Delivery</div>
            <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
              Namecheap Private Email is configured here using the secure official SMTP server. Leave the password blank to keep the current saved password.
            </div>
          </div>

          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            background: 'rgba(59, 130, 246, 0.08)',
            color: '#cbd5f5',
            fontSize: '0.92rem',
            lineHeight: 1.5
          }}>
            Namecheap Private Email requires `mail.privateemail.com`, full email address for SMTP user, and authenticated sending.
            Recommended secure mode is `465` with SSL/TLS. Port `587` uses STARTTLS.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP Host</span>
              <input
                name="smtpHost"
                value={NAMECHEAP_SMTP_HOST}
                readOnly
                style={{ ...fieldStyle, opacity: 0.75, cursor: 'not-allowed' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP Port</span>
              <select name="smtpPort" value={formData.smtpPort} onChange={handleChange} style={fieldStyle}>
                <option value={NAMECHEAP_SMTP_PORT_SSL}>465 - SSL/TLS (Recommended)</option>
                <option value={NAMECHEAP_SMTP_PORT_STARTTLS}>587 - STARTTLS</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP User</span>
              <input
                type="email"
                name="smtpUser"
                value={formData.smtpUser}
                onChange={handleChange}
                placeholder="mailbox@yourdomain.com"
                style={fieldStyle}
                required
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP Password</span>
              <input
                type="password"
                name="smtpPass"
                value={formData.smtpPass}
                onChange={handleChange}
                placeholder={hasStoredSmtpPass ? 'Saved. Leave blank to keep it.' : 'Enter SMTP password'}
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>From Email</span>
              <input
                type="email"
                name="smtpFromEmail"
                value={formData.smtpFromEmail}
                onChange={handleChange}
                placeholder="mailbox@yourdomain.com"
                style={fieldStyle}
                required
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>From Name</span>
              <input
                name="smtpFromName"
                value={formData.smtpFromName}
                onChange={handleChange}
                placeholder="Custom Controller"
                style={fieldStyle}
                required
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#e6edf3' }}>
            <input
              type="checkbox"
              name="smtpSecure"
              checked={Boolean(formData.smtpSecure)}
              readOnly
              disabled
            />
            Use secure SMTP / SSL (automatic from selected port)
          </label>

          {hasStoredSmtpPass && !formData.smtpPass && (
            <div style={{ color: '#8b949e', fontSize: '0.88rem' }}>
              A saved SMTP password already exists in admin settings.
            </div>
          )}
        </section>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.75rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: '#238636',
              color: '#fff',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {message && <div style={{ color: messageTone === 'error' ? '#f87171' : '#4ade80' }}>{message}</div>}
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
