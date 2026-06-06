import React, { useEffect, useState } from 'react';
import { adminGetDoc, adminPatchDoc } from '../../services/backendApi.js';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';
import AdminWhatsAppTemplatesSettings from './AdminWhatsAppTemplatesSettings';

const sectionStyleLarge = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '12px',
  padding: '1.5rem 1.75rem',
  display: 'grid',
  gap: '1.25rem'
};

function SettingsCategory({ step, title, subtitle, isAr, children }) {
  return (
    <>
      <div
        style={{
          textAlign: adminAlign(isAr),
          borderBottom: '1px solid var(--admin-border)',
          paddingBottom: '1rem',
          marginBottom: '0.15rem'
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            color: '#58a6ff',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          {isAr ? `القسم ${step}` : `Section ${step}`}
        </div>
        <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--admin-text)', marginTop: '0.4rem' }}>{title}</div>
        {subtitle ? (
          <div style={{ marginTop: '0.45rem', color: 'var(--admin-muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>{subtitle}</div>
        ) : null}
      </div>
      {children}
    </>
  );
}

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
  tapPublicKey: '',
  abandonedCartReminderDays: 3,
  abandonedCartEmailSubject: '',
  abandonedCartEmailBody: '',
  abandonedCartRecoveryCode: '',
  maintenanceMode: false,
  maintenanceMessageAr: '',
  maintenanceMessageEn: '',
  baseControllerLowStockThreshold: 5
};

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--admin-border)',
  background: 'var(--admin-raised)',
  color: 'var(--admin-text)'
};

const sectionStyle = sectionStyleLarge;

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

function validateNamecheapSmtpForm(formData, hasStoredSmtpPass, isAr) {
  const normalized = normalizeNamecheapSmtpForm(formData);

  if (!normalized.smtpUser) {
    return isAr ? 'مطلوب اسم مستخدم SMTP.' : 'SMTP user is required.';
  }

  if (!isValidEmail(normalized.smtpUser)) {
    return isAr ? 'يجب أن يكون اسم مستخدم SMTP عنوان بريد إلكتروني صالحًا.' : 'SMTP user must be a valid full email address.';
  }

  if (!normalized.smtpFromEmail) {
    return isAr ? 'البريد الإلكتروني للإرسال مطلوب.' : 'From email is required.';
  }

  if (!isValidEmail(normalized.smtpFromEmail)) {
    return isAr ? 'يجب أن يكون البريد الإلكتروني للإرسال عنوان بريد إلكتروني صالحًا.' : 'From email must be a valid email address.';
  }

  if (!String(formData.smtpPass || '').trim() && !hasStoredSmtpPass) {
    return isAr ? 'كلمة مرور SMTP مطلوبة.' : 'SMTP password is required.';
  }

  if (!normalized.smtpFromName) {
    return isAr ? 'اسم المرسل مطلوب.' : 'From name is required.';
  }

  return '';
}

const AdminSettings = ({ lang = 'ar' }) => {
  const [formData, setFormData] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [hasStoredSmtpPass, setHasStoredSmtpPass] = useState(false);

  const isAr = lang === 'ar';

  const t = (path) => {
    const keys = path.split('.');
    let result = i18n[lang];
    if (!result) return path;
    for (const key of keys) {
      result = result[key];
      if (!result) return path;
    }
    return result || path;
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        let snapshot = null;
        try {
          snapshot = await adminGetDoc('admin_settings/general');
        } catch {
          snapshot = null;
        }
        const { path, id, ...snapshotData } = snapshot && typeof snapshot === 'object' ? snapshot : {};
        void path;
        void id;
        if (snapshot && Object.keys(snapshotData).length) {
          const data = snapshotData || {};
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
      const validationError = validateNamecheapSmtpForm(formData, hasStoredSmtpPass, isAr);
      if (validationError) {
        setMessage(validationError);
        setMessageTone('error');
        setSaving(false);
        return;
      }

      const normalizedSmtp = normalizeNamecheapSmtpForm(formData);
      const nextPayload = {
        ...normalizedSmtp,
        updatedAt: new Date().toISOString()
      };

      if (!String(formData.smtpPass || '').trim()) {
        delete nextPayload.smtpPass;
      }

      await adminPatchDoc('admin_settings/general', nextPayload);
      setHasStoredSmtpPass(hasStoredSmtpPass || Boolean(String(formData.smtpPass || '').trim()));
      setFormData((current) => ({ ...current, smtpPass: '' }));
      setMessage(isAr ? 'تم حفظ الإعدادات.' : 'Settings saved.');
      setMessageTone('success');
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage(isAr ? 'فشل في حفظ الإعدادات.' : 'Failed to save settings.');
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  };

  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' };
  const gridWide = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' };

  if (loading) return <LoadingState message={isAr ? "جاري تحميل الإعدادات..." : "Loading settings..."} minHeight="32vh" />;

  return (
    <div style={{ display: 'grid', gap: '2rem', direction: isAr ? 'rtl' : 'ltr', maxWidth: '1100px' }}>
      <div style={{ ...sectionStyle, padding: '1.35rem 1.6rem' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--admin-text)', textAlign: adminAlign(isAr) }}>
          {isAr ? 'إعدادات المتجر' : 'Store settings'}
        </div>
        <div style={{ marginTop: '0.5rem', color: 'var(--admin-muted)', textAlign: adminAlign(isAr), lineHeight: 1.6, fontSize: '0.95rem' }}>
          {isAr
            ? 'قسم الصيانة والأقسام 1–5 تُحفظ معًا بزر «حفظ الإعدادات». قسم قوالب واتساب (6) له زر حفظ منفصل.'
            : 'Maintenance plus sections 1–5 save together with “Save settings”. WhatsApp templates (section 6) use their own save button.'}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>
        <section style={sectionStyle}>
          <SettingsCategory
            step="0"
            title={isAr ? 'وضع الصيانة' : 'Maintenance mode'}
            subtitle={
              isAr
                ? 'عند التفعيل، يرى الزوار رسالة صيانة بالعربية أو الإنجليزية. لوحة الإدارة ونقطة البيع تبقيان متاحتين.'
                : 'When enabled, visitors see a maintenance message in Arabic or English. Admin and POS stay available.'
            }
            isAr={isAr}
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              textAlign: adminAlign(isAr),
              color: formData.maintenanceMode ? '#f85149' : 'var(--admin-text)',
              fontWeight: formData.maintenanceMode ? 700 : 500
            }}
          >
            <input
              type="checkbox"
              name="maintenanceMode"
              checked={Boolean(formData.maintenanceMode)}
              onChange={handleChange}
            />
            <span>{isAr ? 'تفعيل وضع الصيانة للموقع' : 'Enable maintenance mode for the public website'}</span>
          </label>

          <div style={{ ...gridWide, marginTop: '0.5rem' }}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رسالة الصيانة (عربي)' : 'Maintenance message (Arabic)'}</span>
              <textarea
                name="maintenanceMessageAr"
                value={formData.maintenanceMessageAr}
                onChange={handleChange}
                rows={4}
                placeholder={
                  isAr
                    ? 'الموقع قيد الصيانة حالياً…'
                    : 'الموقع قيد الصيانة حالياً. نعمل على تحسين تجربتكم…'
                }
                style={{ ...fieldStyle, resize: 'vertical', minHeight: '6rem' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رسالة الصيانة (إنجليزي)' : 'Maintenance message (English)'}</span>
              <textarea
                name="maintenanceMessageEn"
                value={formData.maintenanceMessageEn}
                onChange={handleChange}
                rows={4}
                placeholder="This website is under maintenance…"
                style={{ ...fieldStyle, resize: 'vertical', minHeight: '6rem' }}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <SettingsCategory
            step={1}
            title={isAr ? 'المتجر وبيانات التواصل' : 'Store & contact details'}
            subtitle={
              isAr
                ? 'اسم المتجر، بريد المسؤول، قنوات التواصل مع العملاء، والعملة وبادئات أرقام الطلبات والفواتير.'
                : 'Store name, admin inbox, customer-facing contact info, currency, and order/invoice prefixes.'
            }
            isAr={isAr}
          />

          <div style={grid2}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'اسم المتجر' : 'Store name'}</span>
              <input name="storeName" value={formData.storeName} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'بريد المسؤول' : 'Admin email'}</span>
              <input name="adminEmail" value={formData.adminEmail} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'بريد الدعم' : 'Support email'}</span>
              <input name="supportEmail" value={formData.supportEmail} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'هاتف الدعم' : 'Support phone'}</span>
              <input name="supportPhone" value={formData.supportPhone} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr), maxWidth: '280px' }}>
              <span>{isAr ? 'حد تنبيه مخزون وحدة التحكم الأساسي' : 'Base controller low-stock threshold'}</span>
              <input
                type="number"
                min={0}
                name="baseControllerLowStockThreshold"
                value={formData.baseControllerLowStockThreshold}
                onChange={handleChange}
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={grid2}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'العملة الافتراضية' : 'Default currency'}</span>
              <input name="defaultCurrency" value={formData.defaultCurrency} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'بادئة الطلب' : 'Order prefix'}</span>
              <input name="orderPrefix" value={formData.orderPrefix} onChange={handleChange} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'بادئة الفاتورة' : 'Invoice prefix'}</span>
              <input name="invoicePrefix" value={formData.invoicePrefix} onChange={handleChange} style={fieldStyle} />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <SettingsCategory
            step={2}
            title={isAr ? 'الموقع والروابط العامة' : 'Website & public links'}
            subtitle={
              isAr
                ? 'عنوان الموقع، الشعار، رابط التتبع، وحسابات التواصل الاجتماعي.'
                : 'Site URL, logo, shipment tracking link builder, and social profiles.'
            }
            isAr={isAr}
          />

          <div style={gridWide}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط الموقع الأساسي' : 'Website base URL'}</span>
              <input
                name="websiteBaseUrl"
                value={formData.websiteBaseUrl}
                onChange={handleChange}
                placeholder="https://customcontroller.co"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط الشعار' : 'Logo URL'}</span>
              <input
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                placeholder="https://customcontroller.co/assets/logo.png"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={gridWide}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط التتبع الأساسي' : 'Tracking base URL'}</span>
              <input
                name="trackingBaseUrl"
                value={formData.trackingBaseUrl}
                onChange={handleChange}
                placeholder="https://carrier.example/track?code={trackingNumber}"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط انستغرام' : 'Instagram URL'}</span>
              <input
                name="instagramUrl"
                value={formData.instagramUrl}
                onChange={handleChange}
                placeholder="https://www.instagram.com/yourstore"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={gridWide}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط تيك توك' : 'TikTok URL'}</span>
              <input
                name="tiktokUrl"
                value={formData.tiktokUrl}
                onChange={handleChange}
                placeholder="https://www.tiktok.com/@yourstore"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'رابط فيسبوك' : 'Facebook URL'}</span>
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
          <SettingsCategory
            step={3}
            title={isAr ? 'الدفع (Tap)' : 'Checkout & payments (Tap)'}
            subtitle={
              isAr
                ? 'مفتاح Tap العام للواجهة الأمامية (التحقق من الدفع يتم من الخادم).'
                : 'Tap public key used on the storefront (server verifies charges).'
            }
            isAr={isAr}
          />
          <div style={{ ...grid2, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? 'مفتاح Tap العام' : 'Tap public key'}</span>
              <input name="tapPublicKey" value={formData.tapPublicKey} onChange={handleChange} style={fieldStyle} />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <SettingsCategory
            step={4}
            title={isAr ? 'البريد الإلكتروني (SMTP)' : 'Email delivery (SMTP)'}
            subtitle={
              isAr
                ? 'بريد Namecheap الخاص عبر الخادم الرسمي. اترك كلمة مرور SMTP فارغة للاحتفاظ بالمحفوظة.'
                : 'Namecheap Private Email via the official SMTP host. Leave SMTP password blank to keep the saved one.'
            }
            isAr={isAr}
          />

          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            background: 'rgba(59, 130, 246, 0.08)',
            color: '#cbd5f5',
            fontSize: '0.92rem',
            lineHeight: 1.5,
            textAlign: adminAlign(isAr)
          }}>
            {isAr ? "يتطلب بريد Namecheap الخاص استخدام `mail.privateemail.com` وعنوان بريد إلكتروني كامل لمستخدم SMTP وإرسالاً موثقاً. وضع الأمان الموصى به هو `465` مع SSL/TLS. يستخدم المنفذ `587` STARTTLS." : "Namecheap Private Email requires `mail.privateemail.com`, full email address for SMTP user, and authenticated sending. Recommended secure mode is `465` with SSL/TLS. Port `587` uses STARTTLS."}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "مضيف SMTP" : "SMTP Host"}</span>
              <input
                name="smtpHost"
                value={NAMECHEAP_SMTP_HOST}
                readOnly
                style={{ ...fieldStyle, opacity: 0.75, cursor: 'not-allowed' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "منفذ SMTP" : "SMTP Port"}</span>
              <select name="smtpPort" value={formData.smtpPort} onChange={handleChange} style={fieldStyle}>
                <option value={NAMECHEAP_SMTP_PORT_SSL}>{isAr ? "465 - SSL/TLS (موصى به)" : "465 - SSL/TLS (Recommended)"}</option>
                <option value={NAMECHEAP_SMTP_PORT_STARTTLS}>587 - STARTTLS</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "مستخدم SMTP" : "SMTP User"}</span>
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

            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "كلمة مرور SMTP" : "SMTP Password"}</span>
              <input
                type="password"
                name="smtpPass"
                value={formData.smtpPass}
                onChange={handleChange}
                placeholder={hasStoredSmtpPass ? (isAr ? 'محفوظة. اتركها فارغة للاحتفاظ بها.' : 'Saved. Leave blank to keep it.') : (isAr ? 'أدخل كلمة مرور SMTP' : 'Enter SMTP password')}
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "البريد الإلكتروني للإرسال" : "From Email"}</span>
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

            <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
              <span>{isAr ? "اسم المرسل" : "From Name"}</span>
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--admin-text)', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <input
              type="checkbox"
              name="smtpSecure"
              checked={Boolean(formData.smtpSecure)}
              readOnly
              disabled
            />
            {isAr ? "استخدام SMTP آمن / SSL (تلقائي حسب المنفذ المحدد)" : "Use secure SMTP / SSL (automatic from selected port)"}
          </label>

          {hasStoredSmtpPass && !formData.smtpPass && (
            <div style={{ color: 'var(--admin-muted)', fontSize: '0.88rem', textAlign: adminAlign(isAr) }}>
              {isAr ? "توجد كلمة مرور SMTP محفوظة بالفعل في إعدادات المسؤول." : "A saved SMTP password already exists in admin settings."}
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <SettingsCategory
            step={5}
            title={isAr ? 'سلات مهجورة واستردادها' : 'Abandoned carts & recovery'}
            subtitle={
              isAr
                ? 'تُسجَّل السلة عند بدء الدفع. بريد تذكيري بعد عدد الأيام (مهمة يومية). استخدم رمز خصم موجودًا في «رموز الخصم».'
                : 'Carts are captured when checkout starts payment. A daily job emails after the delay. Use a discount code that exists under Discount codes.'
            }
            isAr={isAr}
          />

          <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr), maxWidth: '280px' }}>
            <span>{isAr ? 'أيام قبل تذكير البريد' : 'Days before email reminder'}</span>
            <input
              type="number"
              name="abandonedCartReminderDays"
              min={1}
              value={formData.abandonedCartReminderDays}
              onChange={handleChange}
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
            <span>{isAr ? 'رمز الخصم المقترح في البريد' : 'Recovery discount code (must exist)'}</span>
            <input
              name="abandonedCartRecoveryCode"
              value={formData.abandonedCartRecoveryCode}
              onChange={handleChange}
              placeholder="SAVE10"
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
            <span>{isAr ? 'موضوع البريد' : 'Email subject'}</span>
            <input
              name="abandonedCartEmailSubject"
              value={formData.abandonedCartEmailSubject}
              onChange={handleChange}
              placeholder={isAr ? 'أكمل طلبك' : 'Complete your order'}
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
            <span>{isAr ? 'نص البريد (قالب)' : 'Email body template'}</span>
            <textarea
              name="abandonedCartEmailBody"
              value={formData.abandonedCartEmailBody}
              onChange={handleChange}
              rows={8}
              placeholder={'Hi {{customerName}},\n\nYour cart: {{cartTotal}} {{currency}}.\n\n{{recoveryOffer}}\n\n{{cartLink}}'}
              style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>

          <div style={{ fontSize: '0.82rem', color: 'var(--admin-muted)', textAlign: adminAlign(isAr) }}>
            {isAr
              ? 'عناصر: {{customerName}} {{cartTotal}} {{currency}} {{cartLink}} {{recoveryOffer}} {{discountCode}} {{discountDetails}} {{storeName}}'
              : 'Placeholders: {{customerName}} {{cartTotal}} {{currency}} {{cartLink}} {{recoveryOffer}} {{discountCode}} {{discountDetails}} {{storeName}}'}
          </div>
        </section>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.75rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: '#238636',
              color: 'var(--admin-on-primary)',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ الإعدادات" : "Save Settings")}
          </button>

          {message && <div style={{ color: messageTone === 'error' ? '#f87171' : '#4ade80' }}>{message}</div>}
        </div>
      </form>

      <AdminWhatsAppTemplatesSettings lang={lang} />
    </div>
  );
};

export default AdminSettings;
