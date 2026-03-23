import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const Navbar = () => {
    const navigate = useNavigate();
    const [lang, setLang] = useState(localStorage.getItem('ez_lang') || 'ar');
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

    useEffect(() => {
        // Sync language with standard config variables on mount
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

        // Note: For configurator legacy logic
        if (typeof window !== 'undefined') {
            window.__CONFIG_LANG__ = lang;
        }

        // Apply translations to data-i18n attributes natively
        const dict = i18n[lang] || i18n['ar'];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (dict[key]) el.innerHTML = dict[key];
        });

    }, [lang]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setIsAdminAuthenticated(Boolean(currentUser));
        });
        return () => unsubscribe();
    }, []);

    const toggleLanguage = () => {
        const newLang = lang === 'ar' ? 'en' : 'ar';
        setLang(newLang);
        localStorage.setItem('ez_lang', newLang);

        // Hard refresh to reload configurator scripts if on configurator page
        if (window.location.pathname === '/configurator') {
            window.location.reload();
        }
    };

    return (
        <nav className="global-navbar" style={{
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            background: 'var(--card-bg, #1a1a1a)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            padding: '1rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            {/* Left: Logo */}
            <div
                className="nav-logo"
                onClick={() => navigate('/')}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
                <span className="nav-logo-mark" role="img" aria-label="Custom Controller"></span>
            </div>

            {/* Right: Language Toggle only */}
            <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isAdminAuthenticated && (
                    <button
                        onClick={() => navigate('/pos')}
                        className="pos-nav-btn"
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'var(--color-text, #fff)',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        POS
                    </button>
                )}
                <button
                    onClick={toggleLanguage}
                    className="lang-toggle-btn"
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'var(--color-text, #fff)',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}
                >
                    {lang === 'ar' ? 'EN' : 'AR'}
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
