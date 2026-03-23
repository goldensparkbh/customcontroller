import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LoadingState from '../../components/LoadingState.jsx';

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
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: false,
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

const AdminSettings = () => {
  const [formData, setFormData] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
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
            smtpSecure: Boolean(data.smtpSecure),
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
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const nextPayload = {
        ...formData,
        smtpPort: String(formData.smtpPort || '').trim(),
        smtpSecure: Boolean(formData.smtpSecure),
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
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage('Failed to save settings.');
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
              Order emails to the admin and customer use these settings. Leave the password blank to keep the current saved password.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP Host</span>
              <input name="smtpHost" value={formData.smtpHost} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP Port</span>
              <input name="smtpPort" value={formData.smtpPort} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>SMTP User</span>
              <input name="smtpUser" value={formData.smtpUser} onChange={handleChange} style={fieldStyle} />
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
              <input name="smtpFromEmail" value={formData.smtpFromEmail} onChange={handleChange} style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem' }}>
              <span>From Name</span>
              <input name="smtpFromName" value={formData.smtpFromName} onChange={handleChange} style={fieldStyle} />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#e6edf3' }}>
            <input
              type="checkbox"
              name="smtpSecure"
              checked={Boolean(formData.smtpSecure)}
              onChange={handleChange}
            />
            Use secure SMTP / SSL
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

          {message && <div style={{ color: message.includes('Failed') ? '#f87171' : '#4ade80' }}>{message}</div>}
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
