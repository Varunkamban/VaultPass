# VaultPass — Password Management System

A full-stack, zero-knowledge password manager built with:
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS

## Features

- Zero-knowledge vault encryption (AES-GCM, client-side via Web Crypto API)
- PBKDF2 key derivation from master password
- JWT authentication (15-min access + 7-day refresh tokens)
- Bcrypt password hashing
- Multi-Factor Authentication (TOTP — Google Authenticator compatible)
- Vault item types: Login, Secure Note, Card, Identity, SSH Key
- Folder organization with encrypted folder names
- Favorites, search, type filters
- Password generator with strength meter
- Soft delete (Trash) + permanent delete
- Admin console: user management, audit logs, stats
- Rate limiting per endpoint
- Dark/Light mode
- Responsive layout

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

## Setup

### 1. Clone / Navigate to the project

```bash
cd PasswordManagement
```

### 2. Database setup

Create a PostgreSQL database:

```sql
CREATE DATABASE password_management;
```

### 3. Backend

```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT secrets, etc.

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

The backend runs on **http://localhost:5000**

### 4. Frontend

```bash
cd frontend
npm install

# Start development server
npm run dev
```

The frontend runs on **http://localhost:5173**

---

## Environment Variables (backend/.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/password_management` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | — |
| `JWT_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:5173` |
| `BCRYPT_ROUNDS` | Bcrypt hash rounds | `12` |
| `PORT` | Server port | `5000` |

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | None | Register new user |
| `GET` | `/api/v1/auth/prelogin?email=` | None | Get KDF salt for email |
| `POST` | `/api/v1/auth/login` | None | Login |
| `POST` | `/api/v1/auth/refresh` | None | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Bearer | Logout |
| `GET` | `/api/v1/auth/me` | Bearer | Get current user |
| `POST` | `/api/v1/auth/mfa/setup` | Bearer | Setup TOTP MFA |
| `POST` | `/api/v1/auth/mfa/verify` | Bearer | Verify & enable MFA |
| `POST` | `/api/v1/auth/mfa/disable` | Bearer | Disable MFA |
| `POST` | `/api/v1/auth/change-password` | Bearer | Change password |
| `GET` | `/api/v1/auth/sessions` | Bearer | List active sessions |

### Vault
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/vault/items` | List items (filters: type, folder_id, favorite, deleted) |
| `POST` | `/api/v1/vault/items` | Create vault item |
| `GET` | `/api/v1/vault/items/:id` | Get single item |
| `PUT` | `/api/v1/vault/items/:id` | Update item |
| `DELETE` | `/api/v1/vault/items/:id` | Soft delete (trash) |
| `POST` | `/api/v1/vault/items/:id/restore` | Restore from trash |
| `DELETE` | `/api/v1/vault/items/:id/permanent` | Permanent delete |
| `POST` | `/api/v1/vault/items/:id/favorite` | Toggle favorite |
| `DELETE` | `/api/v1/vault/trash` | Empty trash |
| `GET` | `/api/v1/vault/sync?since=` | Delta sync |
| `GET/POST/PUT/DELETE` | `/api/v1/vault/folders` | Folder management |
| `GET/POST/DELETE` | `/api/v1/vault/tags` | Tag management |

### Admin (admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/stats` | Dashboard statistics |
| `GET` | `/api/v1/admin/users` | List users |
| `PATCH` | `/api/v1/admin/users/:id/status` | Change user status |
| `PATCH` | `/api/v1/admin/users/:id/admin` | Toggle admin role |
| `DELETE` | `/api/v1/admin/users/:id` | Soft delete user |
| `GET` | `/api/v1/admin/audit-logs` | Query audit logs |

### Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/tools/password-generate` | Generate password |
| `GET` | `/health` | Health check |

---

## Database Schema

See `backend/src/database/migrations/001_initial.sql` for the complete PostgreSQL schema.

Key tables:
- **users** — accounts with bcrypt auth hash and KDF salt
- **vault_items** — AES-GCM encrypted vault entries
- **folders** — encrypted folder names
- **sessions** — refresh token store
- **audit_logs** — immutable security event log
- **tags**, **vault_item_tags** — tagging system
- **organizations**, **org_members** — multi-tenant support

---

## Security Architecture

- **Zero-knowledge vault**: Server stores only ciphertext; decryption happens client-side
- **Key derivation**: PBKDF2 (100,000 iterations, SHA-256) from master password
- **Vault encryption**: AES-256-GCM with random 96-bit IV per item
- **Auth**: Master password → bcrypt hash stored server-side
- **Tokens**: JWT (HS256) access tokens + opaque refresh tokens
- **Rate limiting**: Per-endpoint limits (5 login attempts/15min, etc.)
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Audit logging**: All auth and vault events logged

## First Admin User

After registering your first user, manually grant admin in PostgreSQL:

```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

---

## Production Checklist

- [ ] Set strong random values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Use PostgreSQL SSL (`DATABASE_URL` with `?sslmode=require`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `FRONTEND_URL` for CORS
- [ ] Enable HTTPS (TLS 1.3)
- [ ] Set up database backups
- [ ] Configure log aggregation (ELK stack / CloudWatch)
