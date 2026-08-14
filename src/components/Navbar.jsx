import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { i18n } from '../i18n';
import { adminMe } from '../services/backendApi.js';
import CurrencySelect from './CurrencySelect.jsx';

const NAV_ITEMS = [
    { to: '/', key: 'navHome', end: true },
    { to: '/configurator', key: 'navCustomize', end: true },
    { to: '/artists', key: 'navArtists' },
    { to: '/collectors', key: 'navCollectors' },
    { to: '/contact', key: 'navContactUs' }
];

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [lang, setLang] = useState(localStorage.getItem('ez_lang') || 'ar');
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const dict = i18n[lang] || i18n.ar || {};
    const t = (key) => dict[key] || key;

    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

        if (typeof window !== 'undefined') {
            window.__CONFIG_LANG__ = lang;
        }

        const currentDict = i18n[lang] || i18n.ar;
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (currentDict[key]) el.textContent = currentDict[key];
        });
        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const key = el.getAttribute('data-i18n-html');
            if (currentDict[key]) el.innerHTML = currentDict[key];
        });
    }, [lang]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const j = await adminMe();
                if (alive) setIsAdminAuthenticated(Boolean(j && j.ok && j.email));
            } catch {
                if (alive) setIsAdminAuthenticated(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.body.classList.toggle('mobile-nav-open', isMobileMenuOpen);
        return () => document.body.classList.remove('mobile-nav-open');
    }, [isMobileMenuOpen]);

    const toggleLanguage = () => {
        const newLang = lang === 'ar' ? 'en' : 'ar';
        setLang(newLang);
        localStorage.setItem('ez_lang', newLang);
        window.dispatchEvent(new CustomEvent('ez-lang-change', { detail: { lang: newLang } }));

        if (window.location.pathname.startsWith('/configurator')) {
            window.location.reload();
        }
    };

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <>
            <nav className="global-navbar">
                <div
                    className="nav-logo"
                    onClick={() => navigate('/')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <span className="nav-logo-mark" role="img" aria-label="Custom Controller"></span>
                </div>

                <div className="global-nav-links" role="navigation" aria-label="Main">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={Boolean(item.end)}
                            className={({ isActive }) => `global-nav-link${isActive ? ' is-active' : ''}`}
                        >
                            {t(item.key)}
                        </NavLink>
                    ))}
                </div>

                <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CurrencySelect />
                    {isAdminAuthenticated && (
                        <button
                            onClick={() => navigate('/pos')}
                            className="pos-nav-btn"
                            type="button"
                        >
                            POS
                        </button>
                    )}
                    <button
                        onClick={toggleLanguage}
                        className="lang-toggle-btn"
                        type="button"
                    >
                        {lang === 'ar' ? 'EN' : 'AR'}
                    </button>
                    <button
                        className="nav-menu-btn global-nav-menu-btn"
                        type="button"
                        aria-label={lang === 'ar' ? 'القائمة' : 'Menu'}
                        aria-expanded={isMobileMenuOpen}
                        onClick={() => setIsMobileMenuOpen((open) => !open)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </nav>

            <div
                className={`global-mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={closeMobileMenu}
            />
            <aside
                className={`global-mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}
                aria-hidden={!isMobileMenuOpen}
            >
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={Boolean(item.end)}
                        className={({ isActive }) => `global-mobile-link${isActive ? ' is-active' : ''}`}
                        onClick={closeMobileMenu}
                    >
                        {t(item.key)}
                    </NavLink>
                ))}
            </aside>
        </>
    );
};

export default Navbar;
