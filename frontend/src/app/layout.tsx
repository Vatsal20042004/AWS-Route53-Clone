import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'AWS Route 53 Clone',
    description:
        'A full-stack clone of the AWS Route 53 DNS management console, built with Next.js and FastAPI.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    {children}
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                            style: {
                                fontSize: '13px',
                                borderRadius: '4px',
                                border: '1px solid #D5DBDB',
                            },
                        }}
                    />
                </AuthProvider>
            </body>
        </html>
    );
}
