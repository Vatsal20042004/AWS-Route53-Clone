'use client';

import { useAuth } from '@/context/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface TopbarProps {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export default function Topbar({ sidebarOpen, onToggleSidebar }: TopbarProps) {
    const { user, logout } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    return (
        <header className="h-12 bg-aws-navy flex items-center justify-between px-4 flex-shrink-0 z-40 relative">
            {/* Left: Hamburger + Logo */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    className="text-gray-300 hover:text-white transition-colors p-1 rounded"
                    aria-label="Toggle sidebar"
                >
                    {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>

                {/* AWS-style logo */}
                <div className="flex items-center gap-2">
                    {/* Simplified AWS logo blocks */}
                    <div className="flex gap-0.5">
                        <div className="w-2 h-3 bg-aws-orange rounded-sm" />
                        <div className="w-2 h-3 bg-aws-orange rounded-sm opacity-70" />
                        <div className="w-2 h-3 bg-aws-orange rounded-sm opacity-40" />
                    </div>
                    <span className="text-white font-semibold text-sm tracking-tight">
                        Route 53
                    </span>
                </div>

                {/* Breadcrumb divider */}
                <span className="text-gray-500 text-sm hidden sm:block">
                    / DNS Management
                </span>
            </div>

            {/* Right: Region + User */}
            <div className="flex items-center gap-4">
                <span className="text-gray-400 text-xs hidden md:block">
                    us-east-1 ▼
                </span>

                {/* User menu */}
                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen((v) => !v)}
                        className="flex items-center gap-1.5 text-gray-200 hover:text-white text-sm transition-colors"
                        id="user-menu-btn"
                    >
                        <div className="w-6 h-6 rounded-full bg-aws-blue flex items-center justify-center text-xs font-medium text-white">
                            {user?.username?.[0]?.toUpperCase() ?? 'A'}
                        </div>
                        <span className="hidden sm:block">{user?.username ?? 'admin'}</span>
                        <span className="text-xs">▼</span>
                    </button>

                    {userMenuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setUserMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-8 w-44 bg-white border border-aws-border rounded shadow-dropdown z-20">
                                <div className="px-4 py-2.5 border-b border-aws-border">
                                    <p className="text-xs text-aws-textMuted">Signed in as</p>
                                    <p className="text-sm font-medium text-aws-text">
                                        {user?.username}
                                    </p>
                                </div>
                                <button
                                    id="logout-btn"
                                    onClick={() => {
                                        setUserMenuOpen(false);
                                        logout();
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-aws-error hover:bg-red-50 transition-colors"
                                >
                                    <LogOut size={14} />
                                    Sign out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
