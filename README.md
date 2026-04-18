# WorkSure Server

Escrow-based marketplace backend for connecting clients with artisans.

## Status

WorkSure has the core modules for the intended product, but it is still in an active hardening phase.

- Implemented: auth, users, artisan profiles, jobs, proposals, contracts, wallets, payments, reviews, disputes, notifications, and admin APIs
- Implemented: Prisma schema, migrations, Swagger setup, Docker assets, and isolated-db e2e test support
- Implemented: session-aware JWT validation, logout, account lockout, sanitization, and rate limiting on auth-sensitive routes
- In progress: financial workflow consolidation, lifecycle enforcement, and broader end-to-end coverage
- Not yet claimed: production readiness

## Product Goal

WorkSure is meant to be a trust-first marketplace where:

1. Clients post jobs.
2. Artisans submit proposals.
3. Accepted proposals become contracts.
4. Clients fund escrow before work starts.
5. Both parties confirm completion.
6. Funds are released safely, with refunds and dispute handling when needed.

The platform's value is not just job discovery. It is trust, escrow safety, and enforceable workflow rules.

## Current Backend Highlights

- JWT authentication with role-based access
- Session-aware token verification and logout support
- Account lockout and security middleware
- Wallet balances, frozen funds, and transaction ledger
- Contract funding, activation, completion confirmation, release, and refund paths
- Admin flows for moderation and dispute handling

## Known Focus Areas

The current work is focused on:

- removing duplicate or conflicting payment/contract paths
- tightening lifecycle checks around contract state transitions
- enforcing artisan verification where the business rules require it
- expanding tests around the full marketplace journey
- keeping the docs aligned with actual tested behavior

## Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Jest
- Swagger / OpenAPI
- Docker

## Local Setup

Prerequisites:

- Node.js 18+
- PostgreSQL 15+

Install:

```bash
npm install
```

Environment:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/worksure_db"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:3000"
```

Database:

```bash
npx prisma generate
npx prisma migrate dev
```

Run:

```bash
npm run start:dev
```

Swagger:

- `http://localhost:3000/api`
- `http://localhost:3000/api/openapi.json`

## Testing

```bash
npm run test
npm run test:e2e
npm run test:cov
```

Tests use isolated databases so development data is not reused. Coverage is strongest around auth and targeted workflow enforcement; broader marketplace lifecycle coverage is still being expanded.

## Deployment Note

Docker and production-oriented configuration files exist, but the project should still go through additional workflow verification before being treated as production-ready.
