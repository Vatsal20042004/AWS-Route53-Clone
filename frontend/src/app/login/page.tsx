'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

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
                err instanceof Error ? err.message : 'Login failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-aws-gray flex flex-col items-center justify-center p-4">
            {/* Header bar */}
            <div className="w-full max-w-sm mb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="flex gap-0.5">
                        <div className="w-3 h-4 bg-aws-orange rounded-sm" />
                        <div className="w-3 h-4 bg-aws-orange rounded-sm opacity-70" />
                        <div className="w-3 h-4 bg-aws-orange rounded-sm opacity-40" />
                    </div>
                    <span className="text-2xl font-bold text-aws-navy tracking-tight">
                        Amazon Route 53
                    </span>
                </div>
                <p className="text-sm text-aws-textMuted">
                    DNS and Traffic Management
                </p>
            </div>

            <div className="card w-full max-w-sm">
                <div className="card-header">
                    <h1 className="card-title">Sign in</h1>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-aws-error">
                            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label htmlFor="username" className="input-label">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            className="input-field"
                            placeholder="admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="input-label">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPw ? 'text' : 'password'}
                                className="input-field pr-10"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aws-textMuted hover:text-aws-text"
                                onClick={() => setShowPw((v) => !v)}
                                aria-label={showPw ? 'Hide password' : 'Show password'}
                            >
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <button
                        id="login-submit-btn"
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full justify-center"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Signing in…
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>

                <div className="px-6 py-3 border-t border-aws-border bg-gray-50 rounded-b text-center">
                    <p className="text-xs text-aws-textMuted">
                        Demo credentials:{' '}
                        <span className="font-mono font-semibold text-aws-text">
                            admin / admin123
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
