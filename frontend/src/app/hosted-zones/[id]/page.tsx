'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    Plus, Search, Pencil, Trash2, RefreshCw, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { zonesApi, recordsApi } from '@/lib/api';
import { HostedZone, DNSRecord, RecordType, DNSRecordCreate } from '@/types';

const RECORD_TYPES: RecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'CAA'];

// ─── Record Form ──────────────────────────────────────────────────────────────

interface RecordFormProps {
    initial?: Partial<DNSRecord>;
    zoneName: string;
    onSubmit: (data: DNSRecordCreate) => Promise<void>;
    onClose: () => void;
    isEdit?: boolean;
}

function RecordForm({ initial, zoneName, onSubmit, onClose, isEdit }: RecordFormProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [type, setType] = useState<RecordType>(initial?.type ?? 'A');
    const [value, setValue] = useState(initial?.value ?? '');
    const [ttl, setTtl] = useState(initial?.ttl?.toString() ?? '300');
    const [priority, setPriority] = useState(initial?.priority?.toString() ?? '');
    const [weight, setWeight] = useState(initial?.weight?.toString() ?? '');
    const [port, setPort] = useState(initial?.port?.toString() ?? '');
    const [loading, setLoading] = useState(false);

    const needsPriority = type === 'MX' || type === 'SRV';
    const needsWeightPort = type === 'SRV';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: DNSRecordCreate = {
                name,
                type,
                value,
                ttl: parseInt(ttl),
                ...(needsPriority && priority ? { priority: parseInt(priority) } : {}),
                ...(needsWeightPort && weight ? { weight: parseInt(weight) } : {}),
                ...(needsWeightPort && port ? { port: parseInt(port) } : {}),
            };
            await onSubmit(payload);
        } finally {
            setLoading(false);
        }
    };

    // TTL presets
    const ttlPresets = [
        { label: '1m', value: '60' },
        { label: '5m', value: '300' },
        { label: '1h', value: '3600' },
        { label: '1d', value: '86400' },
    ];

    const valuePlaceholders: Record<RecordType, string> = {
        A: '93.184.216.34',
        AAAA: '2001:db8::1',
        CNAME: 'alias.example.com',
        TXT: '"v=spf1 include:_spf.example.com ~all"',
        MX: 'mail.example.com',
        NS: 'ns1.example.com',
        PTR: 'hostname.example.com',
        SRV: 'target.example.com',
        CAA: '0 issue letsencrypt.org',
    };

    return (
        <form id="record-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label htmlFor="record-name" className="input-label">
                        Record Name <span className="text-aws-error">*</span>
                    </label>
                    <div className="flex items-center">
                        <input
                            id="record-name"
                            type="text"
                            className="input-field rounded-r-none"
                            placeholder={`subdomain`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <span className="px-3 py-2 bg-gray-50 border border-l-0 border-aws-border rounded-r text-sm text-aws-textMuted whitespace-nowrap">
                            .{zoneName}
                        </span>
                    </div>
                </div>

                <div>
                    <label htmlFor="record-type" className="input-label">
                        Type <span className="text-aws-error">*</span>
                    </label>
                    <select
                        id="record-type"
                        className="input-field"
                        value={type}
                        onChange={(e) => setType(e.target.value as RecordType)}
                    >
                        {RECORD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="record-ttl" className="input-label">TTL (seconds)</label>
                    <div className="flex items-center gap-1">
                        <input
                            id="record-ttl"
                            type="number"
                            className="input-field"
                            value={ttl}
                            onChange={(e) => setTtl(e.target.value)}
                            min={1}
                            required
                        />
                    </div>
                    <div className="flex gap-1 mt-1">
                        {ttlPresets.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                className={`px-2 py-0.5 text-xs rounded border transition-colors ${ttl === p.value ? 'bg-aws-blue text-white border-aws-blue' : 'border-aws-border text-aws-textMuted hover:bg-gray-50'}`}
                                onClick={() => setTtl(p.value)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="col-span-2">
                    <label htmlFor="record-value" className="input-label">
                        Value <span className="text-aws-error">*</span>
                    </label>
                    <textarea
                        id="record-value"
                        className="input-field resize-none font-mono text-sm"
                        rows={type === 'TXT' ? 3 : 2}
                        placeholder={valuePlaceholders[type]}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        required
                    />
                </div>

                {needsPriority && (
                    <div>
                        <label htmlFor="record-priority" className="input-label">
                            Priority <span className="text-aws-error">*</span>
                        </label>
                        <input
                            id="record-priority"
                            type="number"
                            className="input-field"
                            placeholder="10"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            min={0}
                            required={needsPriority}
                        />
                    </div>
                )}

                {needsWeightPort && (
                    <>
                        <div>
                            <label htmlFor="record-weight" className="input-label">
                                Weight <span className="text-aws-error">*</span>
                            </label>
                            <input
                                id="record-weight"
                                type="number"
                                className="input-field"
                                placeholder="20"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                min={0}
                                required={needsWeightPort}
                            />
                        </div>
                        <div>
                            <label htmlFor="record-port" className="input-label">
                                Port <span className="text-aws-error">*</span>
                            </label>
                            <input
                                id="record-port"
                                type="number"
                                className="input-field"
                                placeholder="5060"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                min={1}
                                max={65535}
                                required={needsWeightPort}
                            />
                        </div>
                    </>
                )}

                {type === 'CAA' && (
                    <div className="col-span-2">
                        <p className="text-xs text-aws-textMuted p-2 bg-blue-50 rounded border border-blue-100">
                            CAA value format: <code className="font-mono">flag tag value</code>
                            <br />Example: <code className="font-mono">0 issue letsencrypt.org</code>
                        </p>
                    </div>
                )}
            </div>

            <div className="modal-footer -mx-6 -mb-5 mt-5 px-6">
                <button type="button" className="btn-secondary" onClick={onClose} id="record-form-cancel">
                    Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading} id="record-form-submit">
                    {loading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    ) : isEdit ? 'Save Changes' : 'Create Record'}
                </button>
            </div>
        </form>
    );
}

// ─── Delete Record Confirm ────────────────────────────────────────────────────

function DeleteRecordConfirm({
    record,
    onConfirm,
    onClose,
}: {
    record: DNSRecord;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    return (
        <>
            <p className="text-sm text-aws-text">
                Delete record <strong className="font-mono">{record.name}</strong> ({record.type})?
            </p>
            <p className="mt-2 text-sm text-aws-error">This action cannot be undone.</p>
            <div className="modal-footer -mx-6 -mb-5 mt-5 px-6">
                <button className="btn-secondary" onClick={onClose} id="delete-record-cancel">Cancel</button>
                <button
                    className="btn-danger"
                    disabled={loading}
                    id="delete-record-confirm"
                    onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }}
                >
                    {loading ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ZoneDetailPage() {
    const params = useParams<{ id: string }>();
    const zoneId = params.id;

    const [zone, setZone] = useState<HostedZone | null>(null);
    const [records, setRecords] = useState<DNSRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
    const PAGE_SIZE = 20;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    const fetchZone = useCallback(async () => {
        try {
            const z = await zonesApi.get(zoneId);
            setZone(z);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to load zone');
        }
    }, [zoneId]);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await recordsApi.list(zoneId, {
                search: debouncedSearch || undefined,
                type: typeFilter || undefined,
                page,
                page_size: PAGE_SIZE,
            });
            setRecords(res.data);
            setTotal(res.total);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to load records');
        } finally {
            setLoading(false);
        }
    }, [zoneId, debouncedSearch, typeFilter, page]);

    useEffect(() => { fetchZone(); }, [fetchZone]);
    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const handleCreate = async (data: DNSRecordCreate) => {
        try {
            await recordsApi.create(zoneId, data);
            toast.success(`Record "${data.name}" created`);
            setModal(null);
            fetchRecords();
            fetchZone();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to create record');
        }
    };

    const handleEdit = async (data: DNSRecordCreate) => {
        if (!selectedRecord) return;
        try {
            await recordsApi.update(zoneId, selectedRecord.id, data);
            toast.success('Record updated');
            setModal(null);
            fetchRecords();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to update record');
        }
    };

    const handleDelete = async () => {
        if (!selectedRecord) return;
        try {
            await recordsApi.delete(zoneId, selectedRecord.id);
            toast.success('Record deleted');
            setModal(null);
            fetchRecords();
            fetchZone();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete record');
        }
    };

    const currentZone = zone ? { id: zone.id, name: zone.name } : null;

    return (
        <AppShell currentZone={currentZone}>
            <div className="space-y-4">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-aws-textMuted">
                    <Link href="/hosted-zones" className="hover:text-aws-blue flex items-center gap-1">
                        <ArrowLeft size={13} /> Hosted Zones
                    </Link>
                    <span>/</span>
                    <span className="text-aws-text font-medium">{zone?.name ?? zoneId}</span>
                </div>

                {/* Zone info card */}
                {zone && (
                    <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-aws-textMuted mb-0.5">Zone Name</p>
                            <p className="font-medium font-mono">{zone.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-aws-textMuted mb-0.5">Type</p>
                            <span className={zone.type === 'Public' ? 'badge-public' : 'badge-private'}>
                                {zone.type}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-aws-textMuted mb-0.5">Zone ID</p>
                            <p className="font-mono text-xs text-aws-textMuted truncate">{zone.id}</p>
                        </div>
                        <div>
                            <p className="text-xs text-aws-textMuted mb-0.5">Comment</p>
                            <p className="truncate">{zone.comment ?? '–'}</p>
                        </div>
                    </div>
                )}

                {/* Records table */}
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-aws-text">
                        DNS Records <span className="text-aws-textMuted font-normal text-sm">({total})</span>
                    </h2>
                    <button
                        className="btn-primary"
                        id="create-record-btn"
                        onClick={() => { setSelectedRecord(null); setModal('create'); }}
                    >
                        <Plus size={14} /> Create Record
                    </button>
                </div>

                <div className="card">
                    {/* Toolbar */}
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-aws-border flex-wrap">
                        <div className="relative flex-1 min-w-40 max-w-xs">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aws-textMuted" />
                            <input
                                id="record-search"
                                type="text"
                                className="input-field pl-8"
                                placeholder="Search by name…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            id="record-type-filter"
                            className="input-field w-40"
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Types</option>
                            {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button className="btn-secondary" onClick={() => { fetchRecords(); fetchZone(); }} id="refresh-records-btn" title="Refresh">
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table className="aws-table">
                            <thead>
                                <tr>
                                    <th>Record Name</th>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>TTL</th>
                                    <th>Priority</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-aws-textMuted">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-aws-blue border-t-transparent rounded-full animate-spin" />
                                                Loading…
                                            </div>
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center">
                                            <p className="text-aws-textMuted text-sm">
                                                {debouncedSearch || typeFilter ? 'No records match your filter.' : 'No records yet. Create the first one!'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((rec) => (
                                        <tr key={rec.id} id={`record-row-${rec.id}`}>
                                            <td className="font-mono text-xs max-w-xs truncate">{rec.name}</td>
                                            <td>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-aws-textMuted">
                                                    {rec.type}
                                                </span>
                                            </td>
                                            <td className="font-mono text-xs max-w-xs truncate" title={rec.value}>
                                                {rec.value}
                                            </td>
                                            <td className="tabular-nums text-aws-textMuted">{rec.ttl}s</td>
                                            <td className="tabular-nums text-aws-textMuted">
                                                {rec.priority != null ? (
                                                    <span>
                                                        {rec.priority}
                                                        {rec.weight != null && ` / ${rec.weight}`}
                                                        {rec.port != null && ` :${rec.port}`}
                                                    </span>
                                                ) : '–'}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="btn-secondary !px-2 !py-1"
                                                        id={`edit-record-${rec.id}`}
                                                        title="Edit"
                                                        onClick={() => { setSelectedRecord(rec); setModal('edit'); }}
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        className="btn-danger !px-2 !py-1"
                                                        id={`delete-record-${rec.id}`}
                                                        title="Delete"
                                                        onClick={() => { setSelectedRecord(rec); setModal('delete'); }}
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

                    <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
                </div>
            </div>

            {/* Create */}
            {modal === 'create' && zone && (
                <Modal title="Create DNS Record" onClose={() => setModal(null)} size="lg">
                    <RecordForm zoneName={zone.name} onSubmit={handleCreate} onClose={() => setModal(null)} />
                </Modal>
            )}

            {/* Edit */}
            {modal === 'edit' && selectedRecord && zone && (
                <Modal title="Edit DNS Record" onClose={() => setModal(null)} size="lg">
                    <RecordForm
                        initial={selectedRecord}
                        zoneName={zone.name}
                        onSubmit={handleEdit}
                        onClose={() => setModal(null)}
                        isEdit
                    />
                </Modal>
            )}

            {/* Delete */}
            {modal === 'delete' && selectedRecord && (
                <Modal title="Delete DNS Record" onClose={() => setModal(null)} size="sm">
                    <DeleteRecordConfirm
                        record={selectedRecord}
                        onConfirm={handleDelete}
                        onClose={() => setModal(null)}
                    />
                </Modal>
            )}
        </AppShell>
    );
}
