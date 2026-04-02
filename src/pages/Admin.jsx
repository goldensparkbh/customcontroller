import React, { useEffect, useState } from 'react';
import { i18n } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import AdminOrders from './admin/AdminOrders';
import AdminInvoices from './admin/AdminInvoices';
import AdminPayments from './admin/AdminPayments';
import AdminCustomers from './admin/AdminCustomers';
import AdminItems from './admin/AdminItems';
import AdminParts from './admin/AdminParts';
import AdminInventoryMaster from './admin/AdminInventoryMaster';
import AdminSettings from './admin/AdminSettings';
import AdminTranslations from './admin/AdminTranslations';
import AdminAbandonedCarts from './admin/AdminAbandonedCarts';
import AdminDiscountCodes from './admin/AdminDiscountCodes';
import { AdminNavIcon, IconLogout } from './admin/AdminSidebarIcons';

const ADMIN_ACTIVE_TAB_KEY = 'ez_admin_active_tab';

const Admin = () => {
    const navigate = useNavigate();
    const storedLang = window.localStorage.getItem('ez_lang') || 'ar';
    const [lang, setLang] = useState(storedLang);
    const isAr = lang === 'ar';
    
    const [, setI18nTick] = useState(0);

    const [activeTab, setActiveTab] = useState(() => {
        const storedTab = window.localStorage.getItem(ADMIN_ACTIVE_TAB_KEY);
        const tabs = [
            'orders', 'invoices', 'payments', 'customers',
            'inventory', 'items', 'parts',
            'abandonedCarts', 'discountCodes', 'translations', 'settings'
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
                { id: 'parts', label: t('admin.sidebar.tabs.configPart') }
            ]
        },
        {
            id: 'marketing',
            label: t('admin.sidebar.marketing'),
            items: [
                { id: 'abandonedCarts', label: t('admin.sidebar.tabs.abandonedCarts') },
                { id: 'discountCodes', label: t('admin.sidebar.tabs.discountCodes') }
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

    const navButtonActiveBackground = 'var(--button-primary-bg)';

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
            await signOut(auth);
            navigate('/admin/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    useEffect(() => {
        document.body.style.background = '#0e1117';
        document.body.style.color = '#fff';
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflowY = 'auto';
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        document.documentElement.lang = isAr ? 'ar' : 'en';
        return () => {
            document.body.style.background = '';
            document.body.style.color = '';
            document.documentElement.style.overflowY = '';
            document.body.style.overflowY = '';
        };
    }, [isAr]);

    return (
        <div
            className="admin-dashboard"
            style={{
                display: 'grid',
                /* LTR grid so column 1 is always the left edge and 2 the right edge (rtl on parent mirrors tracks). */
                direction: 'ltr',
                gridTemplateColumns: isAr ? '1fr 300px' : '300px 1fr',
                height: 'calc(100vh - 73px)',
                minHeight: 'calc(100vh - 73px)',
                background: '#0e1117',
                color: '#fff',
                fontFamily: 'Cairo, sans-serif'
            }}
        >
            <aside
                style={{
                    background: '#161b22',
                    borderRight: isAr ? 'none' : '1px solid #30363d',
                    borderLeft: isAr ? '1px solid #30363d' : 'none',
                    padding: '2rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '8px',
                    minHeight: 0,
                    overflowY: 'auto',
                    /* Arabic: right column; English: left column */
                    gridColumn: isAr ? 2 : 1,
                    gridRow: 1,
                    direction: isAr ? 'rtl' : 'ltr',
                    textAlign: isAr ? 'right' : 'left'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexDirection: 'row',
                        /* With aside direction rtl/ltr, flex-start = right cluster (AR) or left cluster (EN) */
                        justifyContent: 'flex-start',
                        gap: '10px',
                        marginBottom: '1.5rem',
                        width: '100%'
                    }}
                >
                    <h2
                        style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            color: '#8b949e',
                            margin: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            textAlign: isAr ? 'right' : 'left'
                        }}
                    >
                        {t('admin.panelTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={toggleLanguage}
                        style={{
                            flexShrink: 0,
                            background: '#21262d',
                            border: '1px solid #30363d',
                            color: '#c9d1d9',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        {lang === 'ar' ? 'English' : 'العربية'}
                    </button>
                </div>

                {navigationGroups.map((group) => (
                    <div key={group.id} style={{ display: 'grid', gap: '6px', width: '100%' }}>
                        {group.label ? (
                            <div
                                style={{
                                    padding: '0.45rem 0.25rem 0.15rem',
                                    color: '#8b949e',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    textAlign: isAr ? 'right' : 'left',
                                    width: '100%'
                                }}
                            >
                                {group.label}
                            </div>
                        ) : null}

                        {group.items.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    gap: '10px',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '12px 14px',
                                    paddingInlineStart: group.label ? '12px' : undefined,
                                    background: activeTab === tab.id ? navButtonActiveBackground : 'transparent',
                                    color: activeTab === tab.id ? '#fff' : '#c9d1d9',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    textAlign: isAr ? 'right' : 'left',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    boxShadow: activeTab === tab.id
                                        ? 'var(--button-primary-shadow), 0 0 0 1px rgba(240,246,252,0.1)'
                                        : 'none'
                                }}
                                onMouseOver={(event) => {
                                    if (activeTab !== tab.id) {
                                        event.currentTarget.style.background = '#21262d';
                                        event.currentTarget.style.color = '#c9d1d9';
                                        event.currentTarget.style.boxShadow = 'none';
                                    }
                                }}
                                onMouseOut={(event) => {
                                    if (activeTab !== tab.id) {
                                        event.currentTarget.style.background = 'transparent';
                                        event.currentTarget.style.color = '#c9d1d9';
                                        event.currentTarget.style.boxShadow = 'none';
                                    }
                                }}
                            >
                                <AdminNavIcon tabId={tab.id} />
                                <span style={{ flex: 1, minWidth: 0 }}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                ))}

                <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '10px',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        background: 'transparent',
                        color: '#eb3942',
                        border: '1px solid #eb3942',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: isAr ? 'right' : 'left',
                        fontSize: '15px',
                        fontWeight: 600,
                        marginTop: 'auto',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(event) => {
                        event.currentTarget.style.background = 'rgba(235, 57, 66, 0.1)';
                    }}
                    onMouseOut={(event) => {
                        event.currentTarget.style.background = 'transparent';
                    }}
                >
                    <IconLogout style={{ color: 'inherit' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{t('admin.sidebar.logout')}</span>
                </button>
            </aside>

            <main
                style={{
                    padding: '2rem',
                    overflowY: 'auto',
                    minHeight: 0,
                    maxHeight: 'calc(100vh - 73px)',
                    WebkitOverflowScrolling: 'touch',
                    /* Arabic: wide column on the left of the viewport; English: wide column on the right */
                    gridColumn: isAr ? 1 : 2,
                    gridRow: 1
                }}
            >
                <div
                    dir={isAr ? 'rtl' : 'ltr'}
                    style={{
                        background: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '10px',
                        padding: '2rem',
                        minHeight: '100%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        textAlign: isAr ? 'right' : 'left'
                    }}
                >
                    <h1
                        style={{
                            fontSize: '24px',
                            fontWeight: 700,
                            marginBottom: '2rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid #30363d',
                            textAlign: isAr ? 'right' : 'left'
                        }}
                    >
                        {navigationGroups.flatMap(g => g.items).find((tab) => tab.id === activeTab)?.label}
                    </h1>

                    {activeTab === 'orders' && <AdminOrders lang={lang} />}
                    {activeTab === 'invoices' && <AdminInvoices lang={lang} />}
                    {activeTab === 'payments' && <AdminPayments lang={lang} />}
                    {activeTab === 'customers' && <AdminCustomers lang={lang} />}
                    {activeTab === 'inventory' && <AdminInventoryMaster lang={lang} />}
                    {activeTab === 'items' && <AdminItems lang={lang} />}
                    {activeTab === 'parts' && <AdminParts lang={lang} />}
                    {activeTab === 'abandonedCarts' && <AdminAbandonedCarts lang={lang} />}
                    {activeTab === 'discountCodes' && <AdminDiscountCodes lang={lang} />}
                    {activeTab === 'translations' && <AdminTranslations lang={lang} />}
                    {activeTab === 'settings' && <AdminSettings lang={lang} />}
                </div>
            </main>
        </div>
    );
};

export default Admin;
