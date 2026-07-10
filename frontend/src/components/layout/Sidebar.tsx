'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
    LayoutDashboard,
    Globe,
    FileText,
    Activity,
    Shield,
    Network,
    BookOpen,
} from 'lucide-react';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    exact?: boolean;
}

const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={15} />, exact: true },
    { label: 'Hosted Zones', href: '/hosted-zones', icon: <Globe size={15} /> },
    { label: 'Traffic Policies', href: '/traffic-policies', icon: <Activity size={15} />, exact: true },
    { label: 'Health Checks', href: '/health-checks', icon: <Shield size={15} />, exact: true },
    { label: 'Resolver', href: '/resolver', icon: <Network size={15} />, exact: true },
    { label: 'Profiles', href: '/profiles', icon: <BookOpen size={15} />, exact: true },
];

interface SidebarProps {
    open: boolean;
    currentZone?: { id: string; name: string } | null;
}

export default function Sidebar({ open, currentZone }: SidebarProps) {
    const pathname = usePathname();

    const isActive = (item: NavItem) => {
        if (item.exact) return pathname === item.href;
        return pathname.startsWith(item.href);
    };

    return (
        <aside
            className={clsx(
                'flex-shrink-0 bg-white border-r border-aws-border flex flex-col transition-all duration-200 overflow-hidden',
                open ? 'w-56' : 'w-0'
            )}
        >
            <div className="pt-3 pb-4 flex flex-col gap-0.5 min-w-56 overflow-y-auto flex-1">
                {/* Section: Route 53 */}
                <div className="px-3 pb-1 pt-2">
                    <p className="text-xs font-semibold text-aws-textMuted uppercase tracking-wider">
                        Route 53
                    </p>
                </div>

                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={clsx('nav-link mx-2', isActive(item) && 'active')}
                        id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                ))}

                {/* Sub-nav: Records inside a zone */}
                {currentZone && (
                    <>
                        <div className="px-3 pb-1 pt-4">
                            <p className="text-xs font-semibold text-aws-textMuted uppercase tracking-wider">
                                Current Zone
                            </p>
                        </div>
                        <div className="mx-2 px-3 py-1.5 text-xs text-aws-textMuted font-mono truncate">
                            {currentZone.name}
                        </div>
                        <Link
                            href={`/hosted-zones/${currentZone.id}`}
                            className={clsx(
                                'nav-link mx-2 pl-6',
                                pathname === `/hosted-zones/${currentZone.id}` && 'active'
                            )}
                            id="nav-records"
                        >
                            <FileText size={14} />
                            Records
                        </Link>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-aws-border px-4 py-3">
                <p className="text-xs text-aws-textMuted">Route53 Clone v1.0</p>
            </div>
        </aside>
    );
}
