import {
    HostedZone,
    HostedZoneCreate,
    HostedZoneUpdate,
    DNSRecord,
    DNSRecordCreate,
    DNSRecordUpdate,
    PaginatedResponse,
    User,
} from '@/types';

const BASE = '/api';

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        },
        ...options,
    });

    if (res.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    if (res.status === 204) return undefined as T;

    const data = await res.json();

    if (!res.ok) {
        const msg = data?.detail ?? `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }

    return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
    login: (username: string, password: string) =>
        apiFetch<{ message: string; username: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    logout: () =>
        apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),

    me: () => apiFetch<User>('/auth/me'),
};

// ─── Hosted Zones ─────────────────────────────────────────────────────────────

export const zonesApi = {
    list: (params?: { search?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams();
        if (params?.search) qs.set('search', params.search);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.page_size) qs.set('page_size', String(params.page_size));
        return apiFetch<PaginatedResponse<HostedZone>>(`/hosted-zones?${qs}`);
    },

    get: (id: string) => apiFetch<HostedZone>(`/hosted-zones/${id}`),

    create: (payload: HostedZoneCreate) =>
        apiFetch<HostedZone>('/hosted-zones', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    update: (id: string, payload: HostedZoneUpdate) =>
        apiFetch<HostedZone>(`/hosted-zones/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    delete: (id: string) =>
        apiFetch<void>(`/hosted-zones/${id}`, { method: 'DELETE' }),
};

// ─── DNS Records ──────────────────────────────────────────────────────────────

export const recordsApi = {
    list: (
        zoneId: string,
        params?: { search?: string; type?: string; page?: number; page_size?: number }
    ) => {
        const qs = new URLSearchParams();
        if (params?.search) qs.set('search', params.search);
        if (params?.type) qs.set('type', params.type);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.page_size) qs.set('page_size', String(params.page_size));
        return apiFetch<PaginatedResponse<DNSRecord>>(
            `/hosted-zones/${zoneId}/records?${qs}`
        );
    },

    get: (zoneId: string, recordId: string) =>
        apiFetch<DNSRecord>(`/hosted-zones/${zoneId}/records/${recordId}`),

    create: (zoneId: string, payload: DNSRecordCreate) =>
        apiFetch<DNSRecord>(`/hosted-zones/${zoneId}/records`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    update: (zoneId: string, recordId: string, payload: DNSRecordUpdate) =>
        apiFetch<DNSRecord>(`/hosted-zones/${zoneId}/records/${recordId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    delete: (zoneId: string, recordId: string) =>
        apiFetch<void>(`/hosted-zones/${zoneId}/records/${recordId}`, {
            method: 'DELETE',
        }),
};
