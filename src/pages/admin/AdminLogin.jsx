import React, { useState } from 'react';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LoadingInline } from '../../components/LoadingState.jsx';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/admin');
        } catch (err) {
            console.error("Login error:", err);
            setError("Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0e1117',
            color: '#fff',
            fontFamily: 'Cairo, sans-serif'
        }}>
            <form onSubmit={handleLogin} style={{
                background: '#161b22',
                padding: '2.5rem',
                borderRadius: '12px',
                border: '1px solid #30363d',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '24px' }}>Admin Login</h1>
                
                {error && (
                    <div style={{
                        background: 'rgba(235, 57, 66, 0.1)',
                        border: '1px solid #eb3942',
                        color: '#eb3942',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#8b949e' }}>Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#0d1117',
                            border: '1px solid #30363d',
                            borderRadius: '6px',
                            color: '#fff',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#8b949e' }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#0d1117',
                            border: '1px solid #30363d',
                            borderRadius: '6px',
                            color: '#fff',
                            outline: 'none'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: '#238636',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => { if(!loading) e.currentTarget.style.background = '#2ea043'; }}
                    onMouseOut={(e) => { if(!loading) e.currentTarget.style.background = '#238636'; }}
                >
                    {loading ? <LoadingInline label="Signing in..." /> : 'Sign In'}
                </button>
            </form>
        </div>
    );
};

export default AdminLogin;
