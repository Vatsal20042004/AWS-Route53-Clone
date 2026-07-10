import AppShell from '@/components/layout/AppShell';

export const metadata = { title: 'Resolver | Route 53' };

export default function ResolverPage() {
    return (
        <AppShell>
            <div className="flex items-center justify-center h-64">
                <div className="card text-center px-12 py-10 max-w-sm w-full">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🔗</span>
                    </div>
                    <h1 className="text-lg font-semibold text-aws-text mb-2">Resolver</h1>
                    <p className="text-sm text-aws-textMuted">Coming soon.</p>
                </div>
            </div>
        </AppShell>
    );
}
