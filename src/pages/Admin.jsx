import React, { useEffect, useState } from 'react';
import { i18n } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { adminLogout } from '../services/backendApi.js';
import './admin/admin-theme.css';
import { AdminThemeProvider, useAdminTheme } from './admin/AdminThemeContext.jsx';
import AdminOrders from './admin/AdminOrders';
import AdminInvoices from './admin/AdminInvoices';
import AdminPayments from './admin/AdminPayments';
import AdminCustomers from './admin/AdminCustomers';
import AdminItems from './admin/AdminItems';
import AdminParts from './admin/AdminParts';
import AdminArtistProducts from './admin/AdminArtistProducts';
import AdminInventoryMaster from './admin/AdminInventoryMaster';
import AdminSettings from './admin/AdminSettings';
import AdminTranslations from './admin/AdminTranslations';
import AdminAbandonedCarts from './admin/AdminAbandonedCarts';
import AdminDiscountCodes from './admin/AdminDiscountCodes';
import AdminHomeBanners from './admin/AdminHomeBanners';
import AdminStockAlerts from './admin/AdminStockAlerts';
import AdminPageHeader from './admin/components/AdminPageHeader.jsx';
import { AdminNavIcon, IconLogout } from './admin/AdminSidebarIcons';

const ADMIN_ACTIVE_TAB_KEY = 'ez_admin_active_tab';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme, isLight } = useAdminTheme();
    const storedLang = window.localStorage.getItem('ez_lang') || 'ar';
    const [lang, setLang] = useState(storedLang);
    const isAr = lang === 'ar';
    
    const [, setI18nTick] = useState(0);

    const [activeTab, setActiveTab] = useState(() => {
        const storedTab = window.localStorage.getItem(ADMIN_ACTIVE_TAB_KEY);
        const tabs = [
            'orders', 'invoices', 'payments', 'customers',
            'inventory', 'items', 'parts', 'artistProducts',
            'abandonedCarts', 'discountCodes', 'homeBanners', 'translations', 'settings'
        ];
        return tabs.includes(storedTab) ? storedTab : 'orders';
    });

    const t = (path) => {
        const keys = path.split('.');
        let result = i18n[lang];
        for (const key of keys) {
            if (!result) return path;
            result = result[key];
        }
        return result || path;
    };

    const navigationGroups = [
        {
            id: 'operations',
            label: t('admin.sidebar.operations'),
            items: [
                { id: 'orders', label: t('admin.sidebar.tabs.orders') },
                { id: 'invoices', label: t('admin.sidebar.tabs.invoices') },
                { id: 'payments', label: t('admin.sidebar.tabs.payments') },
                { id: 'customers', label: t('admin.sidebar.tabs.customers') }
            ]
        },
        {
            id: 'inventoryGroup',
            label: t('admin.sidebar.inventory'),
            items: [
                { id: 'inventory', label: t('admin.sidebar.tabs.inventoryMaster') },
                { id: 'items', label: t('admin.sidebar.tabs.normalItems') },
                { id: 'parts', label: t('admin.sidebar.tabs.configPart') },
                { id: 'artistProducts', label: t('admin.sidebar.tabs.artistProducts') }
            ]
        },
        {
            id: 'marketing',
            label: t('admin.sidebar.marketing'),
            items: [
                { id: 'abandonedCarts', label: t('admin.sidebar.tabs.abandonedCarts') },
                { id: 'discountCodes', label: t('admin.sidebar.tabs.discountCodes') },
                { id: 'homeBanners', label: t('admin.sidebar.tabs.homeBanners') }
            ]
        },
        {
            id: 'system',
            label: t('admin.sidebar.system'),
            items: [
                { id: 'translations', label: t('admin.sidebar.tabs.translations') },
                { id: 'settings', label: t('admin.sidebar.tabs.settings') }
            ]
        }
    ];

    const navPageKey = {
        orders: 'orders',
        invoices: 'invoices',
        payments: 'payments',
        customers: 'customers',
        inventory: 'inventory',
        items: 'items',
        parts: 'parts',
        artistProducts: 'artistProducts',
        abandonedCarts: 'abandonedCarts',
        discountCodes: 'discountCodes',
        homeBanners: 'homeBanners',
        translations: 'translations',
        settings: 'settings'
    };

    const showStockAlert = ['inventory', 'items', 'parts', 'artistProducts', 'settings'].includes(activeTab);
    const activeNav = navigationGroups.flatMap((g) => g.items).find((tab) => tab.id === activeTab);
    const pageGuide = t(`admin.pages.${navPageKey[activeTab] || 'orders'}`);

    const toggleLanguage = () => {
        const newLang = lang === 'ar' ? 'en' : 'ar';
        setLang(newLang);
        window.localStorage.setItem('ez_lang', newLang);
        // Refresh to apply global dir/lang changes to documentElement if needed, 
        // but since we use useEffect [lang] it's reactive.
    };

    useEffect(() => {
        window.localStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab);
    }, [activeTab]);

    useEffect(() => {
        const onI18nUpdated = () => setI18nTick((n) => n + 1);
        window.addEventListener('ez-i18n-updated', onI18nUpdated);
        return () => window.removeEventListener('ez-i18n-updated', onI18nUpdated);
    }, []);

    const handleLogout = async () => {
        try {
            await adminLogout();
            navigate('/admin/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    useEffect(() => {
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflowY = 'auto';
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        document.documentElement.lang = isAr ? 'ar' : 'en';
        return () => {
            document.documentElement.style.overflowY = '';
            document.body.style.overflowY = '';
        };
    }, [isAr]);

    return (
        <div
            className="admin-dashboard"
            data-theme={theme}
            style={{
                display: 'grid',
                /* LTR grid so column 1 is always the left edge and 2 the right edge (rtl on parent mirrors tracks). */
                direction: 'ltr',
                gridTemplateColumns: isAr ? '1fr 300px' : '300px 1fr',
                height: 'calc(100vh - 73px)',
                minHeight: 'calc(100vh - 73px)',
                background: 'var(--admin-app-bg)',
                color: 'var(--admin-text-strong)',
                fontFamily: 'Cairo, sans-serif'
            }}
        >
            <aside
                className="admin-sidebar"
                style={{
                    borderRight: isAr ? 'none' : '1px solid var(--admin-border)',
                    borderLeft: isAr ? '1px solid var(--admin-border)' : 'none',
                    gridColumn: isAr ? 2 : 1,
                    gridRow: 1,
                    direction: isAr ? 'rtl' : 'ltr',
                    textAlign: isAr ? 'right' : 'left'
                }}
            >
                <div className="admin-sidebar__brand">
                    <h2 className="admin-sidebar__title">{t('admin.panelTitle')}</h2>
                    <div className="admin-sidebar__tools">
                        <button
                            type="button"
                            className="admin-sidebar__tool"
                            onClick={toggleTheme}
                            title={isLight ? (isAr ? 'الوضع الداكن' : 'Dark mode') : (isAr ? 'الوضع الفاتح' : 'Light mode')}
                            aria-label={isLight ? (isAr ? 'الوضع الداكن' : 'Dark mode') : (isAr ? 'الوضع الفاتح' : 'Light mode')}
                        >
                            {isLight ? '🌙' : '☀️'}
                        </button>
                        <button type="button" className="admin-sidebar__tool" onClick={toggleLanguage}>
                            {lang === 'ar' ? 'EN' : 'عربي'}
                        </button>
                    </div>
                </div>

                {navigationGroups.map((group) => (
                    <div key={group.id} className="admin-nav-group">
                        {group.label ? <div className="admin-nav-group__label">{group.label}</div> : null}
                        {group.items.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`admin-nav-item${activeTab === tab.id ? ' is-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                style={{ textAlign: isAr ? 'right' : 'left' }}
                            >
                                <AdminNavIcon tabId={tab.id} />
                                <span style={{ flex: 1, minWidth: 0 }}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                ))}

                <button
                    type="button"
                    className="admin-nav-item admin-sidebar__logout"
                    onClick={handleLogout}
                    style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                    <IconLogout style={{ color: 'inherit' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{t('admin.sidebar.logout')}</span>
                </button>
            </aside>

            <main
                style={{
                    padding: '1.5rem 1.75rem',
                    overflowY: 'auto',
                    minHeight: 0,
                    maxHeight: 'calc(100vh - 73px)',
                    WebkitOverflowScrolling: 'touch',
                    gridColumn: isAr ? 1 : 2,
                    gridRow: 1
                }}
            >
                <div
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="admin-main-content"
                    style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                    <AdminPageHeader title={activeNav?.label} subtitle={pageGuide} />

                    {showStockAlert ? (
                        <div className="admin-stock-alert">
                            <AdminStockAlerts lang={lang} />
                        </div>
                    ) : null}

                    <div className="admin-page-shell">
                    {activeTab === 'orders' && <AdminOrders lang={lang} />}
                    {activeTab === 'invoices' && <AdminInvoices lang={lang} />}
                    {activeTab === 'payments' && <AdminPayments lang={lang} />}
                    {activeTab === 'customers' && <AdminCustomers lang={lang} />}
                    {activeTab === 'inventory' && <AdminInventoryMaster lang={lang} />}
                    {activeTab === 'items' && <AdminItems lang={lang} />}
                    {activeTab === 'parts' && <AdminParts lang={lang} />}
                    {activeTab === 'artistProducts' && <AdminArtistProducts lang={lang} />}
                    {activeTab === 'abandonedCarts' && <AdminAbandonedCarts lang={lang} />}
                    {activeTab === 'discountCodes' && <AdminDiscountCodes lang={lang} />}
                    {activeTab === 'homeBanners' && <AdminHomeBanners lang={lang} />}
                    {activeTab === 'translations' && <AdminTranslations lang={lang} />}
                    {activeTab === 'settings' && <AdminSettings lang={lang} />}
                    </div>
                </div>
            </main>
        </div>
    );
};

const Admin = () => (
    <AdminThemeProvider>
        <AdminDashboard />
    </AdminThemeProvider>
);

export default Admin;
