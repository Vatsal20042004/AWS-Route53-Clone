'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (p: number) => void;
}

export default function Pagination({
    page,
    pageSize,
    total,
    onPageChange,
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
        (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
    );

    if (total === 0) return null;

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-aws-border text-sm text-aws-textMuted">
            <span>
                Showing {from}–{to} of {total}
            </span>
            <div className="flex items-center gap-1">
                <button
                    className="page-btn"
                    disabled={page === 1}
                    onClick={() => onPageChange(page - 1)}
                    id="pagination-prev"
                    aria-label="Previous page"
                >
                    <ChevronLeft size={14} />
                </button>

                {pages.map((p, i) => {
                    const prev = pages[i - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                        <span key={p} className="flex items-center gap-1">
                            {showEllipsis && <span className="px-1">…</span>}
                            <button
                                className={clsx('page-btn', p === page && 'active')}
                                onClick={() => onPageChange(p)}
                                id={`pagination-page-${p}`}
                                aria-label={`Page ${p}`}
                            >
                                {p}
                            </button>
                        </span>
                    );
                })}

                <button
                    className="page-btn"
                    disabled={page === totalPages}
                    onClick={() => onPageChange(page + 1)}
                    id="pagination-next"
                    aria-label="Next page"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
