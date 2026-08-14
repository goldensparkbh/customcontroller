import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n.js';

function ContactPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    const onLang = () => setLang(localStorage.getItem('ez_lang') || 'ar');
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add('home-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.classList.remove('home-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(t('formSuccess'));
    e.currentTarget.reset();
  };

  return (
    <div className="contact-page">
      <section className="section" id="contactSection" style={{ marginTop: '24px' }}>
        <div className="section-header">
          <div className="section-title">{t('contactTitle')}</div>
        </div>

        <div className="contact-grid">
          <div className="contact-card">
            <h3>{t('contactCardTitle')}</h3>
            <p>{t('contactCardText')}</p>

            <form onSubmit={handleSubmit}>
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="contact-name">{t('contactLabelName')}</label>
                <input className="contact-input" id="contact-name" name="name" required />
              </div>
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="contact-email">{t('contactLabelEmail')}</label>
                <input className="contact-input" id="contact-email" name="email" type="email" required />
              </div>
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="contact-message">{t('contactLabelMessage')}</label>
                <textarea className="contact-textarea" id="contact-message" name="message" required />
              </div>
              <button className="contact-submit" type="submit">{t('contactSubmit')}</button>
            </form>
          </div>

          <div className="contact-meta" dangerouslySetInnerHTML={{ __html: t('contactMeta') }} />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <button onClick={() => navigate('/privacy')} className="nav-link" type="button">{t('footerPrivacy')}</button>
            <button onClick={() => navigate('/terms')} className="nav-link" type="button">{t('footerTerms')}</button>
            <button onClick={() => navigate('/returns')} className="nav-link" type="button">{t('footerReturns')}</button>
          </div>
          <div className="footer-copyright">
            <span>{t('footerText')}</span>
            <span> {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ContactPage;
