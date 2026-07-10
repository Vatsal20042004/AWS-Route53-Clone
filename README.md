# AWS Route 53 Clone

A full-stack clone of the AWS Route 53 DNS management console, built with **Next.js 14**, **FastAPI**, and **SQLite**.

---

## 📋 Project Overview

This project replicates the core functionality of the AWS Route 53 console, including:
- Hosted zone management (Public/Private)
- DNS record CRUD for all major record types (A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA)
- Paginated, searchable, filterable tables
- JWT-based authentication (mocked with a seeded admin user)
- AWS Console–faithful UI using Next.js + Tailwind CSS

---

## 🚀 Setup Instructions

### Backend (FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install --prefer-binary -r requirements.txt
# Note: bcrypt must be pinned to 4.0.1 for passlib compatibility:
pip install bcrypt==4.0.1

# Seed the database (creates admin user + sample data)
python seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

Backend Swagger UI: http://localhost:8000/docs

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start dev server
npm run dev
```

Frontend: http://localhost:3000

---

## 🏗 Architecture Overview

The application uses a classic three-tier monorepo architecture:

```
Browser (Next.js on :3000)
        │  HTTP (proxied via next.config.js rewrite)
        ▼
FastAPI Server (Uvicorn on :8000)
   ├── JWT auth middleware (httpOnly cookie)
   ├── /auth  → login / logout / me
   ├── /hosted-zones  → CRUD + pagination
   └── /hosted-zones/{id}/records  → CRUD + pagination + validation
        │  SQLAlchemy ORM
        ▼
SQLite Database (backend/data/app.db)
   ├── users
   ├── hosted_zones
   └── dns_records
```

---

## 🗄 Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Auto-increment |
| username | String | Unique |
| password_hash | String | bcrypt hash |
| created_at | DateTime | |

### `hosted_zones`
| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) PK | |
| name | String | e.g. example.com |
| type | Enum | Public / Private |
| comment | Text | Nullable |
| record_count | Integer | Maintained by API |
| created_at | DateTime | |
| updated_at | DateTime | |

### `dns_records`
| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) PK | |
| hosted_zone_id | String FK | Cascade delete |
| name | String | |
| type | Enum | A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA |
| value | Text | |
| ttl | Integer | Default 300 |
| priority | Integer | Nullable — MX, SRV |
| weight | Integer | Nullable — SRV |
| port | Integer | Nullable — SRV |
| created_at | DateTime | |
| updated_at | DateTime | |

---

## 📡 API Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /auth/login | Login, returns JWT in httpOnly cookie |
| POST | /auth/logout | Clears session cookie |
| GET | /auth/me | Returns current user or 401 |
| GET | /hosted-zones | List zones (search, page, page_size) |
| POST | /hosted-zones | Create zone |
| GET | /hosted-zones/{id} | Get single zone |
| PUT | /hosted-zones/{id} | Update zone |
| DELETE | /hosted-zones/{id} | Delete zone + all records |
| GET | /hosted-zones/{zone_id}/records | List records (search, type, page, page_size) |
| POST | /hosted-zones/{zone_id}/records | Create record (type-validated) |
| GET | /hosted-zones/{zone_id}/records/{id} | Get single record |
| PUT | /hosted-zones/{zone_id}/records/{id} | Update record |
| DELETE | /hosted-zones/{zone_id}/records/{id} | Delete record |

All list endpoints return: `{ data: [...], total: number, page: number, page_size: number }`

---

## 🔐 Auth Note

Authentication is **mocked** with a single seeded user:

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

JWT tokens are stored in `httpOnly` cookies with a 60-minute expiry. All `/hosted-zones` and `/records` routes require authentication.

---

## 🗂 Repo Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models.py        # ORM models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # JWT helpers + dependency
│   │   └── routers/
│   │       ├── auth.py      # /auth endpoints
│   │       ├── hosted_zones.py
│   │       └── records.py
│   ├── seed.py              # DB seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # Layout + UI components
│       ├── context/         # Auth context
│       ├── lib/             # API client
│       └── types/           # TypeScript types
├── .gitignore
└── README.md
```
