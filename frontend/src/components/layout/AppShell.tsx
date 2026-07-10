'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

interface AppShellProps {
    children: React.ReactNode;
    currentZone?: { id: string; name: string } | null;
}

export default function AppShell({ children, currentZone }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-aws-gray">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-aws-blue border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-aws-textMuted">Loading console…</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <Topbar
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar open={sidebarOpen} currentZone={currentZone} />
                <main className="flex-1 overflow-auto bg-aws-gray p-5">{children}</main>
            </div>
        </div>
    );
}
