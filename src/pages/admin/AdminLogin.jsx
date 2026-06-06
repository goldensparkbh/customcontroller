import React, { useState } from 'react';
import { adminLogin } from '../../services/backendApi.js';
import { useNavigate } from 'react-router-dom';
import { LoadingInline } from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n.js';
import { adminAlign } from './adminUi.js';
import './admin-theme.css';
import { useAdminThemeStandalone } from './AdminThemeContext.jsx';

const AdminLogin = () => {
    const [lang] = useState(localStorage.getItem('ez_lang') || 'ar');
    const isAr = lang === 'ar';
    const { theme, toggleTheme, isLight } = useAdminThemeStandalone();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const t = (path) => {
        const keys = path.split('.');
        let result = i18n[lang];
        for (const key of keys) {
            if (!result) return path;
            result = result[key];
        }
        return result || path;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await adminLogin(email.trim(), password);
            navigate('/admin');
        } catch (err) {
            console.error("Login error:", err);
            setError(t('admin.login.error'));
        } finally {
            setLoading(false);
        }
    };

    const fieldStyle = {
        width: '100%',
        padding: '12px',
        background: 'var(--admin-raised)',
        border: '1px solid var(--admin-border)',
        borderRadius: '6px',
        outline: 'none',
        textAlign: 'left',
        direction: 'ltr'
    };

    return (
        <div
            className="admin-dashboard"
            data-theme={theme}
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--admin-app-bg)',
                color: 'var(--admin-text-strong)',
                fontFamily: 'Cairo, sans-serif',
                direction: isAr ? 'rtl' : 'ltr',
                padding: '1.5rem'
            }}
        >
            <form
                onSubmit={handleLogin}
                style={{
                    background: 'var(--admin-surface)',
                    padding: '2.5rem',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-border)',
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: 'var(--admin-shadow-lg)',
                    textAlign: adminAlign(isAr)
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '0.75rem'
                    }}
                >
                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={isLight ? (isAr ? 'الوضع الداكن' : 'Dark mode') : (isAr ? 'الوضع الفاتح' : 'Light mode')}
                        aria-label={isLight ? (isAr ? 'الوضع الداكن' : 'Dark mode') : (isAr ? 'الوضع الفاتح' : 'Light mode')}
                        style={{
                            background: 'var(--admin-hover)',
                            border: '1px solid var(--admin-border)',
                            color: 'var(--admin-text-secondary)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        {isLight ? '🌙' : '☀️'}
                    </button>
                </div>

                <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '24px' }}>{t('admin.login.title')}</h1>

                {error && (
                    <div
                        style={{
                            background: 'rgba(235, 57, 66, 0.1)',
                            border: '1px solid #eb3942',
                            color: '#eb3942',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            marginBottom: '1rem',
                            fontSize: '14px',
                            textAlign: 'center'
                        }}
                    >
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--admin-muted)' }}>{t('admin.login.email')}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={fieldStyle} />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--admin-muted)' }}>{t('admin.login.password')}</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={fieldStyle} />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: '#238636',
                        color: 'var(--admin-on-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                    }}
                >
                    {loading ? <LoadingInline label={t('admin.login.signingIn')} /> : t('admin.login.submit')}
                </button>
            </form>
        </div>
    );
};

export default AdminLogin;
