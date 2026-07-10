'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && user) router.push('/hosted-zones');
    }, [user, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : 'Incorrect username or password.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                backgroundColor: '#F2F3F3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                padding: '24px 16px',
            }}
        >
            {/* Logo area */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                {/* AWS-style orange "blocks" logo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        <div style={{ width: '10px', height: '14px', backgroundColor: '#FF9900', borderRadius: '2px' }} />
                        <div style={{ width: '10px', height: '14px', backgroundColor: '#FF9900', borderRadius: '2px', opacity: 0.7 }} />
                        <div style={{ width: '10px', height: '14px', backgroundColor: '#FF9900', borderRadius: '2px', opacity: 0.4 }} />
                    </div>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#232F3E',
                        textTransform: 'uppercase',
                    }}>
                        Amazon Route 53
                    </span>
                </div>
                <p style={{ fontSize: '12px', color: '#687078' }}>DNS and Traffic Management</p>
            </div>

            {/* Card */}
            <div style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
                border: '1px solid #D5DBDB',
                overflow: 'hidden',
            }}>
                {/* Card header */}
                <div style={{
                    padding: '20px 28px 16px',
                    borderBottom: '1px solid #EAEDED',
                }}>
                    <h1 style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: '#16191F',
                        margin: 0,
                    }}>
                        Sign in
                    </h1>
                </div>

                {/* Form body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px 28px' }}>
                    {/* Error banner */}
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '10px 14px',
                            backgroundColor: '#FBEAEA',
                            border: '1px solid #f5c6c6',
                            borderRadius: '4px',
                            marginBottom: '20px',
                            fontSize: '13px',
                            color: '#D13212',
                        }}>
                            <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Username */}
                    <div style={{ marginBottom: '18px' }}>
                        <label
                            htmlFor="username"
                            style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#16191F',
                                marginBottom: '6px',
                            }}
                        >
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                            placeholder="admin"
                            style={{
                                display: 'block',
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '9px 12px',
                                fontSize: '14px',
                                color: '#16191F',
                                backgroundColor: '#fff',
                                border: '1px solid #adb5bd',
                                borderRadius: '4px',
                                outline: 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onFocus={e => {
                                e.target.style.borderColor = '#0972D3';
                                e.target.style.boxShadow = '0 0 0 3px rgba(9,114,211,0.15)';
                            }}
                            onBlur={e => {
                                e.target.style.borderColor = '#adb5bd';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '24px' }}>
                        <label
                            htmlFor="password"
                            style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#16191F',
                                marginBottom: '6px',
                            }}
                        >
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="password"
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                placeholder="Enter password"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '9px 42px 9px 12px',
                                    fontSize: '14px',
                                    color: '#16191F',
                                    backgroundColor: '#fff',
                                    border: '1px solid #adb5bd',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = '#0972D3';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(9,114,211,0.15)';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = '#adb5bd';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                            <button
                                type="button"
                                aria-label={showPw ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPw(v => !v)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#687078',
                                    fontSize: '13px',
                                    padding: '2px',
                                    lineHeight: 1,
                                }}
                            >
                                {showPw ? '🙈' : '👁'}
                            </button>
                        </div>
                    </div>

                    {/* Submit button */}
                    <button
                        id="login-submit-btn"
                        type="submit"
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '10px 16px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#ffffff',
                            backgroundColor: loading ? '#5BA4E5' : '#0972D3',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.15s',
                            letterSpacing: '0.01em',
                        }}
                        onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#0558A8'; }}
                        onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#0972D3'; }}
                    >
                        {loading ? (
                            <>
                                <span style={{
                                    display: 'inline-block',
                                    width: '14px',
                                    height: '14px',
                                    border: '2px solid #ffffff60',
                                    borderTopColor: '#ffffff',
                                    borderRadius: '50%',
                                    animation: 'spin 0.7s linear infinite',
                                }} />
                                Signing in…
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>
            </div>

            {/* Helper text */}
            <p style={{
                marginTop: '20px',
                fontSize: '12px',
                color: '#687078',
                textAlign: 'center',
            }}>
                Demo credentials:{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16191F' }}>
                    admin / admin123
                </span>
            </p>

            {/* Spinner keyframe */}
            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
