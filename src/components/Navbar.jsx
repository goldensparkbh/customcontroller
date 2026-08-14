import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { i18n } from '../i18n';
import { adminMe } from '../services/backendApi.js';
import CurrencySelect from './CurrencySelect.jsx';
import { readCartCount } from '../utils/shopCart.js';

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
    const [cartCount, setCartCount] = useState(readCartCount);

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
        setCartCount(readCartCount());
    }, [location.pathname]);

    useEffect(() => {
        const syncCart = () => setCartCount(readCartCount());
        window.addEventListener('ez-cart-change', syncCart);
        window.addEventListener('storage', syncCart);
        return () => {
            window.removeEventListener('ez-cart-change', syncCart);
            window.removeEventListener('storage', syncCart);
        };
    }, []);

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
                        className="nav-cart-btn"
                        type="button"
                        aria-label={lang === 'ar' ? 'السلة' : 'Cart'}
                        onClick={() => navigate('/cart')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6h15l-1.5 9h-12L6 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="9" cy="20" r="1.4" fill="currentColor" />
                            <circle cx="18" cy="20" r="1.4" fill="currentColor" />
                        </svg>
                        {cartCount > 0 && <span className="nav-cart-badge">{cartCount}</span>}
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
