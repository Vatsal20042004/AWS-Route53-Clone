'use client';

import AppShell from '@/components/layout/AppShell';

function ComingSoon({ title }: { title: string }) {
    return (
        <AppShell>
            <div className="flex items-center justify-center h-64">
                <div className="card text-center px-12 py-10 max-w-sm w-full">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🚧</span>
                    </div>
                    <h2 className="text-lg font-semibold text-aws-text mb-2">{title}</h2>
                    <p className="text-sm text-aws-textMuted">
                        This section is coming soon. Check back later.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}

export function DashboardPage() {
    return <ComingSoon title="Dashboard" />;
}

export function TrafficPoliciesPage() {
    return <ComingSoon title="Traffic Policies" />;
}

export function HealthChecksPage() {
    return <ComingSoon title="Health Checks" />;
}

export function ResolverPage() {
    return <ComingSoon title="Resolver" />;
}

export function ProfilesPage() {
    return <ComingSoon title="Profiles" />;
}

export default ComingSoon;
