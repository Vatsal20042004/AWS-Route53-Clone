// ─── Enums ────────────────────────────────────────────────────────────────────

export type ZoneType = 'Public' | 'Private';

export type RecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'PTR' | 'SRV' | 'CAA';

// ─── Hosted Zone ──────────────────────────────────────────────────────────────

export interface HostedZone {
    id: string;
    name: string;
    type: ZoneType;
    comment: string | null;
    record_count: number;
    created_at: string;
    updated_at: string;
}

export interface HostedZoneCreate {
    name: string;
    type: ZoneType;
    comment?: string;
}

export interface HostedZoneUpdate {
    name?: string;
    type?: ZoneType;
    comment?: string;
}

// ─── DNS Record ───────────────────────────────────────────────────────────────

export interface DNSRecord {
    id: string;
    hosted_zone_id: string;
    name: string;
    type: RecordType;
    value: string;
    ttl: number;
    priority: number | null;
    weight: number | null;
    port: number | null;
    created_at: string;
    updated_at: string;
}

export interface DNSRecordCreate {
    name: string;
    type: RecordType;
    value: string;
    ttl: number;
    priority?: number;
    weight?: number;
    port?: number;
}

export interface DNSRecordUpdate {
    name?: string;
    type?: RecordType;
    value?: string;
    ttl?: number;
    priority?: number;
    weight?: number;
    port?: number;
}

// ─── Paginated ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    page_size: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
    id: number;
    username: string;
    created_at: string;
}
