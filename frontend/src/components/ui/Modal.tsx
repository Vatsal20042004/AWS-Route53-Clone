'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
};

export default function Modal({
    title,
    onClose,
    children,
    footer,
    size = 'md',
}: ModalProps) {
    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`modal-box w-full ${sizeMap[size]}`} role="dialog" aria-modal="true">
                <div className="modal-header">
                    <h2 className="text-base font-semibold text-aws-text">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-aws-textMuted hover:text-aws-text transition-colors"
                        aria-label="Close modal"
                        id="modal-close-btn"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
