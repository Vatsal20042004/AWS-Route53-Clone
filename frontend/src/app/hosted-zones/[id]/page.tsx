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

// ─── Client-side value validation (mirrors backend rules) ─────────────────────

const HOSTNAME_RE = /^(?!-)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$|^::[\da-fA-F]{0,4}$|^[\da-fA-F]{0,4}::$/;
const CAA_RE = /^(0|128)\s+(issue|issuewild|iodef)\s+"[^"]+"$/;

function isValidIPv4(v: string): boolean {
    const m = IPV4_RE.exec(v.trim());
    if (!m) return false;
    return [m[1], m[2], m[3], m[4]].every(n => parseInt(n) >= 0 && parseInt(n) <= 255);
}

function isValidIPv6(v: string): boolean {
    // Basic structural check; handles compressed notation (::)
    const s = v.trim();
    const segments = s.split(':');
    if (s.includes('::')) {
        // At most one ::
        if ((s.match(/::/g) || []).length > 1) return false;
        return segments.length <= 8;
    }
    return segments.length === 8 && segments.every(seg => /^[\da-fA-F]{0,4}$/.test(seg));
}

function isValidHostname(v: string): boolean {
    return HOSTNAME_RE.test(v.trim()) && v.trim().length <= 253;
}

function validateValue(type: RecordType, value: string): string {
    const v = value.trim();
    if (!v) return ''; // empty handled separately by 'required'

    switch (type) {
        case 'A':
            if (!isValidIPv4(v))
                return `Invalid IPv4 address. Expected format: 192.0.2.1 (four dot-separated numbers 0–255)`;
            break;
        case 'AAAA':
            if (!isValidIPv6(v))
                return `Invalid IPv6 address. Expected format: 2001:db8::1`;
            break;
        case 'CNAME':
        case 'MX':
        case 'NS':
        case 'PTR':
        case 'SRV':
            if (!isValidHostname(v))
                return `Invalid hostname. Use letters, digits, hyphens and dots only (no spaces, no bare IPs).`;
            break;
        case 'TXT':
            if (v.length > 255)
                return `TXT value must be 255 characters or fewer (currently ${v.length} chars).`;
            break;
        case 'CAA':
            if (!CAA_RE.test(v))
                return `Invalid CAA format. Required: <flag> <tag> "<value>" — e.g. 0 issue "letsencrypt.org"\nFlag: 0 or 128 · Tag: issue, issuewild, or iodef`;
            break;
    }
    return '';
}

// ─── Placeholder text per type ────────────────────────────────────────────────

const VALUE_PLACEHOLDERS: Record<RecordType, string> = {
    A: '192.0.2.1',
    AAAA: '2001:db8::1',
    CNAME: 'alias.example.com',
    TXT: 'v=spf1 include:_spf.example.com ~all',
    MX: 'mail.example.com',
    NS: 'ns1.example.com',
    PTR: 'hostname.example.com',
    SRV: 'target.example.com',
    CAA: '0 issue "letsencrypt.org"',
};

const VALUE_HINTS: Record<RecordType, string> = {
    A: 'IPv4 address — four dot-separated numbers (0–255)',
    AAAA: 'IPv6 address — e.g. 2001:db8::1',
    CNAME: 'Hostname — letters, digits, hyphens, dots',
    TXT: 'Any text string, max 255 characters',
    MX: 'Mail server hostname — e.g. mail.example.com',
    NS: 'Nameserver hostname — e.g. ns1.example.com',
    PTR: 'Reverse DNS hostname',
    SRV: 'Target hostname — e.g. sipserver.example.com',
    CAA: 'Flag Tag "Value" — e.g. 0 issue "letsencrypt.org"',
};

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
    const [valueErr, setValueErr] = useState('');

    const needsPriority = type === 'MX' || type === 'SRV';
    const needsWeightPort = type === 'SRV';

    // Revalidate live as user types
    const handleValueChange = (v: string) => {
        setValue(v);
        if (v.trim()) setValueErr(validateValue(type, v));
        else setValueErr('');
    };

    // Re-run validation when type changes (value may now be wrong for new type)
    useEffect(() => {
        if (value.trim()) setValueErr(validateValue(type, value));
        else setValueErr('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final validation before submit
        const err = validateValue(type, value);
        if (err) { setValueErr(err); return; }

        setLoading(true);
        try {
            await onSubmit({
                name,
                type,
                value: value.trim(),
                ttl: parseInt(ttl),
                ...(needsPriority && priority ? { priority: parseInt(priority) } : {}),
                ...(needsWeightPort && weight ? { weight: parseInt(weight) } : {}),
                ...(needsWeightPort && port ? { port: parseInt(port) } : {}),
            });
        } finally {
            setLoading(false);
        }
    };

    const ttlPresets = [
        { label: '1 min', value: '60' },
        { label: '5 min', value: '300' },
        { label: '1 hr', value: '3600' },
        { label: '1 day', value: '86400' },
    ];

    return (
        <form id="record-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Name */}
            <div>
                <label htmlFor="record-name" className="input-label">
                    Record Name <span style={{ color: '#D13212' }}>*</span>
                </label>
                <div style={{ display: 'flex' }}>
                    <input
                        id="record-name"
                        type="text"
                        className="input-field"
                        style={{ borderRadius: '4px 0 0 4px' }}
                        placeholder="subdomain or @"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                    <span style={{
                        padding: '8px 12px',
                        backgroundColor: '#F8F8F8',
                        border: '1px solid #D5DBDB',
                        borderLeft: 'none',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '13px',
                        color: '#687078',
                        whiteSpace: 'nowrap',
                    }}>
                        .{zoneName}
                    </span>
                </div>
            </div>

            {/* Type + TTL row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                    <label htmlFor="record-type" className="input-label">
                        Type <span style={{ color: '#D13212' }}>*</span>
                    </label>
                    <select
                        id="record-type"
                        className="input-field"
                        value={type}
                        onChange={e => setType(e.target.value as RecordType)}
                    >
                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="record-ttl" className="input-label">TTL (seconds)</label>
                    <input
                        id="record-ttl"
                        type="number"
                        className="input-field"
                        value={ttl}
                        onChange={e => setTtl(e.target.value)}
                        min={1}
                        required
                    />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {ttlPresets.map(p => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setTtl(p.value)}
                                style={{
                                    padding: '2px 7px',
                                    fontSize: '11px',
                                    borderRadius: '3px',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    backgroundColor: ttl === p.value ? '#0972D3' : '#fff',
                                    borderColor: ttl === p.value ? '#0972D3' : '#D5DBDB',
                                    color: ttl === p.value ? '#fff' : '#687078',
                                    transition: 'all 0.12s',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Value */}
            <div>
                <label htmlFor="record-value" className="input-label">
                    Value <span style={{ color: '#D13212' }}>*</span>
                </label>
                <textarea
                    id="record-value"
                    className="input-field"
                    style={{
                        resize: 'vertical',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        minHeight: type === 'TXT' ? '72px' : '54px',
                        borderColor: valueErr ? '#D13212' : undefined,
                        boxShadow: valueErr ? '0 0 0 3px rgba(209,50,18,0.12)' : undefined,
                    }}
                    placeholder={VALUE_PLACEHOLDERS[type]}
                    value={value}
                    onChange={e => handleValueChange(e.target.value)}
                    required
                />

                {/* Inline hint — shown only when no error */}
                {!valueErr && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#687078' }}>
                        {VALUE_HINTS[type]}
                    </p>
                )}

                {/* Validation error */}
                {valueErr && (
                    <div
                        id="value-error-msg"
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            marginTop: '6px',
                            padding: '8px 10px',
                            backgroundColor: '#FBEAEA',
                            border: '1px solid #f5c6c6',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#D13212',
                            whiteSpace: 'pre-line',   // allows \n in error messages
                        }}
                    >
                        <span style={{ flexShrink: 0, fontSize: '13px' }}>⚠</span>
                        <span>{valueErr}</span>
                    </div>
                )}
            </div>

            {/* Priority (MX / SRV) */}
            {needsPriority && (
                <div>
                    <label htmlFor="record-priority" className="input-label">
                        Priority <span style={{ color: '#D13212' }}>*</span>{' '}
                        <span style={{ fontWeight: 400, color: '#687078' }}>(0–65535)</span>
                    </label>
                    <input
                        id="record-priority"
                        type="number"
                        className="input-field"
                        placeholder="10"
                        value={priority}
                        onChange={e => setPriority(e.target.value)}
                        min={0} max={65535}
                        required={needsPriority}
                    />
                </div>
            )}

            {/* Weight + Port (SRV only) */}
            {needsWeightPort && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label htmlFor="record-weight" className="input-label">
                            Weight <span style={{ color: '#D13212' }}>*</span>
                        </label>
                        <input
                            id="record-weight"
                            type="number"
                            className="input-field"
                            placeholder="20"
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            min={0}
                            required={needsWeightPort}
                        />
                    </div>
                    <div>
                        <label htmlFor="record-port" className="input-label">
                            Port <span style={{ color: '#D13212' }}>*</span>{' '}
                            <span style={{ fontWeight: 400, color: '#687078' }}>(1–65535)</span>
                        </label>
                        <input
                            id="record-port"
                            type="number"
                            className="input-field"
                            placeholder="5060"
                            value={port}
                            onChange={e => setPort(e.target.value)}
                            min={1} max={65535}
                            required={needsWeightPort}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="modal-footer" style={{ margin: '4px -24px -20px', padding: '12px 24px' }}>
                <button type="button" className="btn-secondary" onClick={onClose} id="record-form-cancel">
                    Cancel
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading || !!valueErr}
                    id="record-form-submit"
                >
                    {loading
                        ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
                        : isEdit ? 'Save Changes' : 'Create Record'}
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
            <p style={{ fontSize: '14px', color: '#16191F' }}>
                Delete record{' '}
                <strong style={{ fontFamily: 'monospace' }}>{record.name}</strong>{' '}
                ({record.type})?
            </p>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#D13212' }}>
                This action cannot be undone.
            </p>
            <div className="modal-footer" style={{ margin: '16px -24px -20px', padding: '12px 24px' }}>
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
        try { setZone(await zonesApi.get(zoneId)); }
        catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to load zone'); }
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#687078' }}>
                    <Link href="/hosted-zones" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0972D3', textDecoration: 'none' }}>
                        <ArrowLeft size={13} /> Hosted Zones
                    </Link>
                    <span>/</span>
                    <span style={{ color: '#16191F', fontWeight: 500 }}>{zone?.name ?? zoneId}</span>
                </div>

                {/* Zone info card */}
                {zone && (
                    <div className="card" style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        <div>
                            <p style={{ fontSize: '11px', color: '#687078', marginBottom: '2px' }}>Zone Name</p>
                            <p style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>{zone.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', color: '#687078', marginBottom: '4px' }}>Type</p>
                            <span className={zone.type === 'Public' ? 'badge-public' : 'badge-private'}>{zone.type}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', color: '#687078', marginBottom: '2px' }}>Zone ID</p>
                            <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#687078' }}>{zone.id}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', color: '#687078', marginBottom: '2px' }}>Comment</p>
                            <p style={{ fontSize: '13px' }}>{zone.comment ?? '–'}</p>
                        </div>
                    </div>
                )}

                {/* Records header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#16191F', margin: 0 }}>
                        DNS Records{' '}
                        <span style={{ fontWeight: 400, fontSize: '13px', color: '#687078' }}>({total})</span>
                    </h2>
                    <button
                        className="btn-primary"
                        id="create-record-btn"
                        onClick={() => { setSelectedRecord(null); setModal('create'); }}
                    >
                        <Plus size={14} /> Create Record
                    </button>
                </div>

                {/* Records table card */}
                <div className="card">
                    {/* Toolbar */}
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #EAEDED', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
                            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9AA5B4' }} />
                            <input
                                id="record-search"
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '30px' }}
                                placeholder="Search by name…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            id="record-type-filter"
                            className="input-field"
                            style={{ width: '140px', flex: '0 0 auto' }}
                            value={typeFilter}
                            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Types</option>
                            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button className="btn-secondary" style={{ padding: '7px 10px' }} onClick={() => { fetchRecords(); fetchZone(); }} id="refresh-records-btn" title="Refresh">
                            <RefreshCw size={13} />
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
                                    <th>Priority / Weight / Port</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#687078' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <div className="spinner spinner-dark" />
                                                Loading…
                                            </div>
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#687078', fontSize: '13px' }}>
                                            {debouncedSearch || typeFilter
                                                ? 'No records match your filter.'
                                                : 'No records yet. Create the first one!'}
                                        </td>
                                    </tr>
                                ) : records.map(rec => (
                                    <tr key={rec.id} id={`record-row-${rec.id}`} style={{ cursor: 'default' }}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{rec.name}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center',
                                                padding: '2px 7px', borderRadius: '3px',
                                                fontSize: '11px', fontWeight: 700,
                                                backgroundColor: '#F0F0F0', color: '#37475A',
                                                letterSpacing: '0.03em',
                                            }}>
                                                {rec.type}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.value}>
                                            {rec.value}
                                        </td>
                                        <td style={{ color: '#687078', tabularNums: true } as React.CSSProperties}>{rec.ttl}s</td>
                                        <td style={{ color: '#687078', fontSize: '12px' }}>
                                            {rec.priority != null
                                                ? `${rec.priority}${rec.weight != null ? ` / ${rec.weight}` : ''}${rec.port != null ? ` : ${rec.port}` : ''}`
                                                : '–'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '5px 8px' }}
                                                    id={`edit-record-${rec.id}`}
                                                    title="Edit"
                                                    onClick={() => { setSelectedRecord(rec); setModal('edit'); }}
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    className="btn-danger"
                                                    style={{ padding: '5px 8px' }}
                                                    id={`delete-record-${rec.id}`}
                                                    title="Delete"
                                                    onClick={() => { setSelectedRecord(rec); setModal('delete'); }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
                </div>
            </div>

            {/* Create modal */}
            {modal === 'create' && zone && (
                <Modal title="Create DNS Record" onClose={() => setModal(null)} size="lg">
                    <RecordForm zoneName={zone.name} onSubmit={handleCreate} onClose={() => setModal(null)} />
                </Modal>
            )}

            {/* Edit modal */}
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

            {/* Delete modal */}
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
