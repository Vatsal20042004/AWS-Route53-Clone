# Design Document — AWS Route 53 Clone

*Last updated: July 2026*

---

## 1. Overview

This project is a full-stack web application that replicates the AWS Route 53 DNS management console. It provides a browser-based UI for creating, reading, updating, and deleting hosted zones and DNS records across nine record types (A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA). The scope is deliberately limited to **data management UI**: records are stored in a local SQLite database and are never pushed into real DNS infrastructure — no zone transfers occur, no resolvers are notified, and TTL values have no operational effect. Authentication is mocked with a single seeded user rather than integrating with AWS IAM. The intent is a faithful UI/UX and API reproduction of the Route 53 console to demonstrate full-stack engineering skills, not to build production DNS infrastructure.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  Next.js 14 (App Router, React Server + Client Components)      │
│  Hosted on Vercel                                               │
│  https://aws-route53-clone-h70mxg33q-maxie2.vercel.app         │
└───────────────────────┬─────────────────────────────────────────┘
                        │  All API calls proxied via
                        │  next.config.js rewrite rule:
                        │  /api/* → NEXT_PUBLIC_API_URL/*
                        │  (HTTP/HTTPS, with credentials for cookies)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.13, Uvicorn ASGI)                            │
│  Hosted on Railway                                              │
│  https://aws-route53-clone-production.up.railway.app           │
│                                                                 │
│  Routers:                                                       │
│  ├── /auth          → login / logout / me                       │
│  ├── /hosted-zones  → zone CRUD + pagination                    │
│  └── /hosted-zones/{id}/records → record CRUD + validation      │
│                                                                 │
│  Middleware: CORSMiddleware (allow_credentials=True)            │
│  Auth: JWT (HS256) read from httpOnly cookie on each request    │
└───────────────────────┬─────────────────────────────────────────┘
                        │  SQLAlchemy ORM (synchronous session)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLite — app.db                                                │
│  Mounted on a Railway persistent volume at /data/app.db         │
│                                                                 │
│  Tables: users · hosted_zones · dns_records                     │
└─────────────────────────────────────────────────────────────────┘
```

**Monorepo rationale.** The project lives in a single git repository (`/backend` and `/frontend` subdirectories) but is deployed as two independent services. This separation keeps deployment boundaries clean — the backend can be restarted, redeployed, or swapped for a different database without touching the frontend build, and vice versa. A single monolith would have been simpler locally but harder to deploy: Vercel is purpose-built for Next.js edge delivery and Railway handles long-running Python processes with persistent volumes. Splitting along that natural seam means each service uses the platform best suited to it.

---

## 3. Tech Stack & Rationale

| Technology | Version | Why this project uses it |
|---|---|---|
| **Next.js 14** | 14.x | App Router provides server/client component split; built-in rewrite rules proxy `/api/*` to the backend without CORS complexity in local dev |
| **TypeScript** | 5.x | Catches mismatches between API response shapes and UI state at compile time — especially valuable with 9 DNS record types each having different required fields |
| **Tailwind CSS** | 3.x | Utility-first classes allow rapid iteration on the AWS Console color palette and spacing without writing custom CSS for every variant |
| **FastAPI** | 0.115.5 | Async-capable Python framework with automatic OpenAPI (`/docs`) generation; Pydantic integration makes request validation and response serialization declarative |
| **SQLAlchemy** | 2.0.36 | ORM provides a Python-level schema definition that doubles as the source of truth for migrations; `cascade="all, delete-orphan"` is one line rather than a manual `ON DELETE CASCADE` trigger |
| **SQLite** | (stdlib) | Zero-infrastructure for development and sufficient for single-user demo traffic; the file is placed on a Railway persistent volume so it survives restarts |
| **JWT (HS256)** | python-jose 3.3.0 | Stateless session token stored in an `httpOnly` cookie avoids the need for a session store; token expiry (60 min, configurable) is enforced on every request by the `get_current_user` dependency |
| **passlib + bcrypt** | 1.7.4 / 4.0.1 | Industry-standard password hashing; split into two explicit packages because `passlib[bcrypt]` pulled a version of `bcrypt` incompatible with Python 3.13's C extension build on Windows |

---

## 4. Data Model

### Tables, columns, and types

#### `users`
| Column | SQLAlchemy type | Constraints |
|---|---|---|
| `id` | `Integer` | PK, autoincrement, indexed |
| `username` | `String` | unique, not null, indexed |
| `password_hash` | `String` | not null |
| `created_at` | `DateTime` | default `utcnow` |

The `users` table uses an auto-increment integer PK because user records are internal-only and never exposed in URLs. There is currently one seeded row (`admin`).

#### `hosted_zones`
| Column | SQLAlchemy type | Constraints |
|---|---|---|
| `id` | `String` | PK (UUID), indexed |
| `name` | `String` | not null, indexed |
| `type` | `Enum(ZoneType)` | `Public` or `Private`, not null |
| `comment` | `Text` | nullable |
| `record_count` | `Integer` | default 0 |
| `created_at` | `DateTime` | default `utcnow` |
| `updated_at` | `DateTime` | default + `onupdate` `utcnow` |

**UUID primary keys for zones and records.** AWS Route 53 itself uses opaque string IDs (e.g., `Z1PA6795UKMFR9`). Using UUIDs here matches that convention and avoids leaking creation order through sequential integers, which matters when IDs appear in URLs.

**Denormalized `record_count`.** The record count displayed on the zone list page is stored as a column rather than computed with `COUNT(*)` on each list read. With SQLite and single-user traffic this would make no measurable difference, but incrementing/decrementing on create/delete keeps the pattern consistent with how Route 53's console itself works — showing counts without an additional join on every zone list page. The trade-off is that the count can drift if records are deleted outside the API; a `_refresh_record_count` helper in `hosted_zones.py` recomputes it when needed.

**Relationship.** `HostedZone.records` is a SQLAlchemy `relationship` with `cascade="all, delete-orphan"`. Deleting a zone via the ORM cascades the delete to all child `DNSRecord` rows without requiring a manual loop or raw SQL. The FK definition also specifies `ondelete="CASCADE"` at the database level as a belt-and-suspenders guarantee for any direct SQL deletes.

#### `dns_records`
| Column | SQLAlchemy type | Constraints |
|---|---|---|
| `id` | `String` | PK (UUID), indexed |
| `hosted_zone_id` | `String` | FK → `hosted_zones.id` (CASCADE), not null |
| `name` | `String` | not null |
| `type` | `Enum(RecordType)` | one of 9 values, not null |
| `value` | `Text` | not null |
| `ttl` | `Integer` | default 300 |
| `priority` | `Integer` | nullable — populated for MX and SRV |
| `weight` | `Integer` | nullable — populated for SRV only |
| `port` | `Integer` | nullable — populated for SRV only |
| `created_at` | `DateTime` | default `utcnow` |
| `updated_at` | `DateTime` | default + `onupdate` `utcnow` |

`value` is `Text` (not `String`) to accommodate long TXT records without a length constraint. `priority`, `weight`, and `port` are nullable integers in the same table rather than separate type-specific tables because the record set is small and polymorphic sub-tables would add join complexity for marginal benefit at this scale.

---

## 5. API Design

All endpoints require authentication (JWT in `access_token` cookie) except `/auth/login`.

### Auth — prefix `/auth`

| Method | Path | Status codes | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | 200, 401 | Validates credentials, sets `httpOnly` cookie containing JWT |
| `POST` | `/auth/logout` | 200 | Deletes the `access_token` cookie |
| `GET` | `/auth/me` | 200, 401 | Returns the authenticated user object |

### Hosted Zones — prefix `/hosted-zones`

| Method | Path | Status codes | Purpose |
|---|---|---|---|
| `GET` | `/hosted-zones` | 200, 401 | List zones — supports `?search=`, `?page=`, `?page_size=` |
| `POST` | `/hosted-zones` | 201, 401, 422 | Create zone |
| `GET` | `/hosted-zones/{zone_id}` | 200, 401, 404 | Get single zone |
| `PUT` | `/hosted-zones/{zone_id}` | 200, 401, 404 | Update zone name/type/comment |
| `DELETE` | `/hosted-zones/{zone_id}` | 204, 401, 404 | Delete zone and all child records |

### DNS Records — prefix `/hosted-zones/{zone_id}/records`

| Method | Path | Status codes | Purpose |
|---|---|---|---|
| `GET` | `/hosted-zones/{zone_id}/records` | 200, 401, 404 | List records — supports `?search=`, `?type=`, `?page=`, `?page_size=` |
| `POST` | `/hosted-zones/{zone_id}/records` | 201, 401, 404, 422 | Create record with type-specific validation |
| `GET` | `/hosted-zones/{zone_id}/records/{record_id}` | 200, 401, 404 | Get single record |
| `PUT` | `/hosted-zones/{zone_id}/records/{record_id}` | 200, 401, 404, 422 | Update record; re-runs full validation |
| `DELETE` | `/hosted-zones/{zone_id}/records/{record_id}` | 204, 401, 404 | Delete record |

### `GET /health`
Returns `{"status": "ok"}` with no auth required. Used by Railway's health-check probe.

### Pagination envelope

All list endpoints return the same shape:

```json
{
  "data": [ ...items... ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

A consistent envelope was chosen so the frontend pagination component (`Pagination.tsx`) can be reused across zones and records without any type-specific logic — it only needs `total`, `page`, and `page_size`. The frontend always knows the real total count for rendering page numbers, rather than inferring it from whether the returned array is shorter than `page_size`.

---

## 6. Validation Strategy

DNS record values are constrained by type-specific format rules. These are enforced in `backend/app/routers/records.py` in two functions: `_validate_value` (format) and `_validate_record_full` (format + numeric field presence/range). Validation runs on both `POST` and `PUT`.

**Per-type rules (backend):**

| Record type | Validation method | Rule |
|---|---|---|
| `A` | `ipaddress.IPv4Address(v)` | Must be a valid IPv4 address; raises `ValueError` on anything else including out-of-range octets like `999.x.x.x` |
| `AAAA` | `ipaddress.IPv6Address(v)` | Must be a valid IPv6 address including compressed notation (`::`) |
| `CNAME`, `MX`, `NS`, `PTR`, `SRV` | RFC 1123 hostname regex | Letters, digits, hyphens, dots; no leading hyphen; max 253 characters total |
| `TXT` | Length check | Value must be ≤ 255 characters |
| `CAA` | Regex `^(0\|128)\s+(issue\|issuewild\|iodef)\s+"[^"]+"$` | Flag must be `0` or `128`; tag must be `issue`, `issuewild`, or `iodef`; value must be double-quoted |
| `MX` | Numeric check | `priority` required, must be 0–65535 |
| `SRV` | Numeric check | `priority`, `weight`, `port` all required; port must be 1–65535, priority 0–65535 |

**Why backend is the source of truth.** The API is publicly reachable (Swagger UI at `/docs` is open). Any client — curl, Postman, a malicious script — can bypass the browser entirely. Backend validation returning `HTTP 422` with a descriptive `detail` string is the only enforcement that actually matters.

**Why there is also frontend validation.** The frontend duplicates the same rules in `validateValue()` in `page.tsx` (using equivalent regexes and range checks). This is purely for UX: it shows an inline red error message as the user types and disables the Submit button before the request is even sent. It does not replace backend validation; it reduces round-trips for obvious mistakes.

---

## 7. Authentication & Security

**Mechanism.** On `POST /auth/login`, the backend looks up the username in the `users` table and verifies the submitted password against the stored bcrypt hash using `passlib`. On success it mints a JWT signed with `SECRET_KEY` (HS256, configurable via env var) and writes it into an `httpOnly` cookie (`access_token`, `max_age=3600`, `samesite=lax`). Every subsequent request to a protected route passes through the `get_current_user` FastAPI dependency, which reads the cookie, decodes the JWT, and loads the User row. No session store is involved — the token is self-contained.

**Mocked single user.** There is no registration flow and no user management UI. The `users` table contains one row created by `seed.py` (`admin` / `admin123`). This is intentional and appropriate for the assignment scope: the goal is to demonstrate authenticated access control at the API layer, not user lifecycle management. Every deployed developer-demo project needs *some* credential gate and a seeded admin is the simplest one that works.

**What is intentionally out of scope:**
- **Multi-tenancy / resource ownership**: all authenticated users (currently one) can read and mutate all zones. Real Route 53 scopes data to an AWS account.
- **RBAC**: no role differentiation. Real Route 53 uses IAM policies with fine-grained resource ARNs.
- **Registration / password reset / session revocation**: none implemented. Tokens cannot be invalidated before expiry short of restarting the server (no token blocklist).
- **HTTPS-only cookies**: the `secure=False` flag in `routers/auth.py` line 26 means the cookie is sent over plain HTTP. In production this must be `True`; Railway provides HTTPS termination by default so this is purely a configuration oversight.

---

## 8. Deployment Architecture

### Backend — Railway

Railway runs the FastAPI app as a Docker-based service using `uvicorn app.main:app`. The critical deployment decision is the **persistent volume**. Railway (like most PaaS providers on free/hobby tiers) uses ephemeral container filesystems: any file written to the container's local disk is lost when the container restarts, redeploys, or is moved to a new node. SQLite is a file (`data/app.db`). Without a persistent volume, every backend restart would wipe the database and require re-seeding.

Railway's persistent volumes attach a durable network disk at a fixed mount path that survives restarts. `database.py` writes the SQLite file to `./data/app.db` relative to the app root. The `data/` directory is created at startup if it does not exist (`data_dir.mkdir(parents=True, exist_ok=True)`), and `DATABASE_URL` is configurable via environment variable so the mount path can be adjusted without a code change.

Environment variables set in Railway:
- `SECRET_KEY` — production secret (not the `fallback-secret-key` default)
- `DATABASE_URL` — path to the persisted SQLite file
- `ALGORITHM` — `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — `60`

### Frontend — Vercel

Vercel builds and deploys the Next.js app on every git push. The key configuration is in `next.config.js`:

```js
destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`
```

In local development `NEXT_PUBLIC_API_URL` is unset, so requests to `/api/*` proxy to `http://localhost:8000`. In production, `NEXT_PUBLIC_API_URL` is set to `https://aws-route53-clone-production.up.railway.app` in the Vercel environment variable dashboard. The Next.js rewrite rule rewrites the path — `/api/hosted-zones` becomes `/hosted-zones` on the Railway server — so the backend router prefixes (`/hosted-zones`, `/auth`) remain unchanged. This single env var is the only difference between the local and production build; no code paths change.

### CORS

`main.py` configures `CORSMiddleware` with `allow_credentials=True` and an explicit origin list:
- `http://localhost:3000` (local dev)
- `https://aws-route53-clone.vercel.app` (marked as placeholder at time of writing — **must be updated** to `https://aws-route53-clone-h70mxg33q-maxie2.vercel.app`)

---

## 9. Known Limitations & Trade-offs

- **SQLite write concurrency.** SQLite serializes writes at the file level. A single concurrent user is unaffected; multiple simultaneous writers would queue up or produce `database is locked` errors. Acceptable for a demo with one active session; not acceptable for multi-user production. Migrating to PostgreSQL (also available on Railway) is a single `DATABASE_URL` change plus removing `check_same_thread=False`.

- **No real DNS propagation.** Records stored in this application have no effect on actual DNS resolution. No zone files are generated, no nameserver delegation occurs, and no resolver will serve these records. The application is a UI for managing structured data that *represents* DNS records.

- **Single hardcoded user.** There is no registration endpoint and no way to add users through the UI. The `admin` user is created by running `seed.py`. If the database is wiped (e.g., fresh Railway volume or local machine), the seed must be re-run manually before the app is usable.

- **CORS origin list is hardcoded.** The allowed origin list in `main.py` is a Python list literal. Adding a new frontend deployment domain requires a code change and redeploy of the backend. A better approach for a long-lived project would be to read origins from an environment variable.

- **Cookie `secure=False` in auth router.** Currently will transmit the session cookie over plain HTTP. Safe on Railway (HTTPS-terminated at the load balancer before reaching the app) but should be explicitly set to `True` or made configurable via env var.

- **No audit log.** Mutations (create/update/delete zone or record) are not logged. In a real DNS management system, an audit trail (who changed what, when) is a compliance requirement.

---

## 10. Future Improvements

- **BIND zone file import/export.** Let users upload a standard RFC 1035 zone file and parse it into records, or export a zone as a BIND-compatible zone file. This would make the tool useful for migrating real zones into or out of the system.

- **Multi-user support with resource ownership.** Add a registration endpoint, associate zones with a `user_id` foreign key, and scope all queries to the authenticated user's own resources. This mirrors how Route 53 scopes data to an AWS account.

- **PostgreSQL migration.** Swap SQLite for PostgreSQL (trivially available on Railway) to support concurrent writes and enable proper connection pooling. The SQLAlchemy ORM layer means the migration is largely a `DATABASE_URL` change plus removing the `check_same_thread` argument.

- **Real-time DNS lookup validation.** When a user enters a CNAME target or NS hostname, optionally perform a live DNS lookup (via a backend endpoint calling a resolver) to warn if the target does not resolve — giving operators a sanity check before saving, without blocking the save.
