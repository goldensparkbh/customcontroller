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

const AdminSettings = () => {
  const [formData, setFormData] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'admin_settings', 'general'));
        if (snapshot.exists()) {
          setFormData({ ...defaultSettings, ...snapshot.data() });
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      }
      setLoading(false);
    };
    run();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await setDoc(
        doc(db, 'admin_settings', 'general'),
        {
          ...formData,
          updatedAt: new Date()
        },
        { merge: true }
      );
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
      <div
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem'
        }}
      >
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>General Settings</div>
        <div style={{ marginTop: '0.35rem', color: '#8b949e' }}>
          Store-wide admin values used for operations, billing labels, customer support, and future integrations.
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem',
          display: 'grid',
          gap: '1rem'
        }}
      >
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

        <label style={{ display: 'grid', gap: '0.45rem' }}>
          <span>Tracking Base URL</span>
          <input name="trackingBaseUrl" value={formData.trackingBaseUrl} onChange={handleChange} style={fieldStyle} />
        </label>

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
