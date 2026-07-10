'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    Plus, Search, Pencil, Trash2, Globe, RefreshCw, ChevronRight,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { zonesApi } from '@/lib/api';
import { HostedZone, ZoneType } from '@/types';

// ─── Zone Modal Form ──────────────────────────────────────────────────────────

interface ZoneFormProps {
    initial?: Partial<HostedZone>;
    onSubmit: (data: { name: string; type: ZoneType; comment: string }) => Promise<void>;
    onClose: () => void;
    isEdit?: boolean;
}

function ZoneForm({ initial, onSubmit, onClose, isEdit }: ZoneFormProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState<ZoneType>(initial?.type ?? 'Public');
    const [comment, setComment] = useState(initial?.comment ?? '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({ name, type, comment });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form id="zone-form" onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="zone-name" className="input-label">
                        Domain Name <span className="text-aws-error">*</span>
                    </label>
                    <input
                        id="zone-name"
                        type="text"
                        className="input-field"
                        placeholder="example.com"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isEdit}
                    />
                    {isEdit && (
                        <p className="text-xs text-aws-textMuted mt-1">
                            Domain name cannot be changed after creation.
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="zone-type" className="input-label">
                        Type <span className="text-aws-error">*</span>
                    </label>
                    <select
                        id="zone-type"
                        className="input-field"
                        value={type}
                        onChange={(e) => setType(e.target.value as ZoneType)}
                    >
                        <option value="Public">Public</option>
                        <option value="Private">Private</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="zone-comment" className="input-label">
                        Comment
                    </label>
                    <textarea
                        id="zone-comment"
                        className="input-field resize-none"
                        rows={3}
                        placeholder="Optional description"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </div>
            </div>
            <div className="modal-footer -mx-6 -mb-5 mt-5 px-6">
                <button type="button" className="btn-secondary" onClick={onClose} id="zone-form-cancel">
                    Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading} id="zone-form-submit">
                    {loading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    ) : isEdit ? 'Save Changes' : 'Create Hosted Zone'}
                </button>
            </div>
        </form>
    );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
    zone,
    onConfirm,
    onClose,
}: {
    zone: HostedZone;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    return (
        <>
            <p className="text-sm text-aws-text">
                Are you sure you want to delete{' '}
                <strong className="font-mono">{zone.name}</strong>?
            </p>
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-aws-error">
                This will also permanently delete all{' '}
                <strong>{zone.record_count}</strong> DNS record
                {zone.record_count !== 1 ? 's' : ''} in this zone. This action cannot
                be undone.
            </div>
            <div className="modal-footer -mx-6 -mb-5 mt-5 px-6">
                <button className="btn-secondary" onClick={onClose} id="delete-zone-cancel">
                    Cancel
                </button>
                <button
                    className="btn-danger"
                    disabled={loading}
                    id="delete-zone-confirm"
                    onClick={async () => {
                        setLoading(true);
                        await onConfirm();
                        setLoading(false);
                    }}
                >
                    {loading ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HostedZonesPage() {
    const router = useRouter();
    const [zones, setZones] = useState<HostedZone[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
    const [selectedZone, setSelectedZone] = useState<HostedZone | null>(null);
    const PAGE_SIZE = 20;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    const fetchZones = useCallback(async () => {
        setLoading(true);
        try {
            const res = await zonesApi.list({
                search: debouncedSearch || undefined,
                page,
                page_size: PAGE_SIZE,
            });
            setZones(res.data);
            setTotal(res.total);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to load zones');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, page]);

    useEffect(() => { fetchZones(); }, [fetchZones]);

    const handleCreate = async (data: { name: string; type: ZoneType; comment: string }) => {
        try {
            await zonesApi.create(data);
            toast.success(`Hosted zone "${data.name}" created`);
            setModal(null);
            fetchZones();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to create zone');
        }
    };

    const handleEdit = async (data: { name: string; type: ZoneType; comment: string }) => {
        if (!selectedZone) return;
        try {
            await zonesApi.update(selectedZone.id, {
                type: data.type,
                comment: data.comment,
            });
            toast.success('Hosted zone updated');
            setModal(null);
            fetchZones();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to update zone');
        }
    };

    const handleDelete = async () => {
        if (!selectedZone) return;
        try {
            await zonesApi.delete(selectedZone.id);
            toast.success(`"${selectedZone.name}" deleted`);
            setModal(null);
            fetchZones();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete zone');
        }
    };

    return (
        <AppShell>
            <div className="space-y-4">
                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-aws-text">Hosted Zones</h1>
                        <p className="text-sm text-aws-textMuted mt-0.5">
                            Manage your DNS hosted zones
                        </p>
                    </div>
                    <button
                        className="btn-primary"
                        id="create-zone-btn"
                        onClick={() => { setSelectedZone(null); setModal('create'); }}
                    >
                        <Plus size={15} />
                        Create Hosted Zone
                    </button>
                </div>

                {/* Table card */}
                <div className="card">
                    {/* Toolbar */}
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-aws-border">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aws-textMuted" />
                            <input
                                id="zone-search"
                                type="text"
                                className="input-field pl-8"
                                placeholder="Search by name…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn-secondary"
                            onClick={fetchZones}
                            id="refresh-zones-btn"
                            title="Refresh"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table className="aws-table">
                            <thead>
                                <tr>
                                    <th>Domain Name</th>
                                    <th>Type</th>
                                    <th>Records</th>
                                    <th>Comment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-aws-textMuted">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-aws-blue border-t-transparent rounded-full animate-spin" />
                                                Loading…
                                            </div>
                                        </td>
                                    </tr>
                                ) : zones.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Globe size={32} className="text-aws-textMuted" />
                                                <p className="text-aws-textMuted text-sm">
                                                    {debouncedSearch ? `No zones match "${debouncedSearch}"` : 'No hosted zones yet. Create your first one!'}
                                                </p>
                                                {!debouncedSearch && (
                                                    <button className="btn-primary text-xs" onClick={() => setModal('create')}>
                                                        <Plus size={12} /> Create Hosted Zone
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    zones.map((zone) => (
                                        <tr
                                            key={zone.id}
                                            id={`zone-row-${zone.id}`}
                                            onClick={() => router.push(`/hosted-zones/${zone.id}`)}
                                        >
                                            <td>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium text-aws-blue hover:underline cursor-pointer">
                                                        {zone.name}
                                                    </span>
                                                    <ChevronRight size={12} className="text-aws-textMuted" />
                                                </div>
                                                <div className="text-xs text-aws-textMuted mt-0.5 font-mono">{zone.id}</div>
                                            </td>
                                            <td>
                                                <span className={zone.type === 'Public' ? 'badge-public' : 'badge-private'}>
                                                    {zone.type}
                                                </span>
                                            </td>
                                            <td className="tabular-nums">{zone.record_count}</td>
                                            <td className="text-aws-textMuted max-w-xs truncate">{zone.comment ?? '–'}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="btn-secondary !px-2 !py-1"
                                                        id={`edit-zone-${zone.id}`}
                                                        title="Edit"
                                                        onClick={() => { setSelectedZone(zone); setModal('edit'); }}
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        className="btn-danger !px-2 !py-1"
                                                        id={`delete-zone-${zone.id}`}
                                                        title="Delete"
                                                        onClick={() => { setSelectedZone(zone); setModal('delete'); }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={total}
                        onPageChange={setPage}
                    />
                </div>
            </div>

            {/* Create Modal */}
            {modal === 'create' && (
                <Modal title="Create Hosted Zone" onClose={() => setModal(null)}>
                    <ZoneForm onSubmit={handleCreate} onClose={() => setModal(null)} />
                </Modal>
            )}

            {/* Edit Modal */}
            {modal === 'edit' && selectedZone && (
                <Modal title="Edit Hosted Zone" onClose={() => setModal(null)}>
                    <ZoneForm
                        initial={selectedZone}
                        onSubmit={handleEdit}
                        onClose={() => setModal(null)}
                        isEdit
                    />
                </Modal>
            )}

            {/* Delete Modal */}
            {modal === 'delete' && selectedZone && (
                <Modal title="Delete Hosted Zone" onClose={() => setModal(null)}>
                    <DeleteConfirm
                        zone={selectedZone}
                        onConfirm={handleDelete}
                        onClose={() => setModal(null)}
                    />
                </Modal>
            )}
        </AppShell>
    );
}
