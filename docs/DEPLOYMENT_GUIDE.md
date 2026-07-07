# WorkSure Production Deployment Guide

WorkSure consists of two entirely decoupled repositories running on different servers and scaling independently. 

*   **Backend (`worksure-server`)**: NestJS Monolith exposing REST APIs, Socket.IO WebSockets, and running background BullMQ workers.
*   **Frontend (`worksure-ui`)**: Next.js 16 (React 19) App Router web app, acting as a BFF (Backend-for-Frontend) proxying requests to the backend API and managing session cookies.

---

## 1. Repository Setup & Architecture

```text
  [ Client Browser / PWA ]
              │
              │  HTTP/HTTPS (Secure, httpOnly cookie)
              ▼
    [ worksure-ui (Next.js) ] (Port 3000)
              │
              │  Server-to-Server REST / proxy
              ▼
  [ worksure-server (NestJS) ] (Port 8000)
              │
              ├─► [ PostgreSQL ] (Persistent Data)
              ├─► [ Redis ] (Sessions, BullMQ, Idempotency)
              └─► [ Paystack ] (External Escrow & Transfers)
```

Both environments should be configured in separate CI/CD chains (configured in their respective `.github/workflows/ci.yml` paths).

---

## 2. Backend Deployment (`worksure-server`)

The backend is packaged inside a multi-stage Docker container utilizing Node.js LTS and runs as a non-root user.

### Production Environment Variables
Configure these in your production host (e.g., Railway, AWS ECS, or Render):

| Variable | Type | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations, logging scopes, and cookie security. |
| `PORT` | `number` | Port the API listens on (default `8000`). |
| `DATABASE_URL` | `string` | Connection string for PostgreSQL (must enable SSL). |
| `REDIS_URL` | `string` | Connection string for Redis (requires TLS `rediss://`). |
| `JWT_SECRET` | `string` | High-entropy signature key for API access tokens. |
| `JWT_EXPIRES_IN` | `string` | Token expiry duration (e.g. `1h`). |
| `ALLOWED_ORIGINS` | `string` | Comma-separated list of whitelisted frontend URLs (CORS). |
| `PAYSTACK_SECRET` | `string` | Paystack Live Secret Key for payments, virtual accounts, and payouts. |
| `PAYSTACK_WEBHOOK_SECRET` | `string` | Signature validation key provided by Paystack dashboard for webhooks. |
| `RESEND_API_KEY` | `string` | Resend API key for dispatching transactional emails. |
| `CLOUDINARY_URL` | `string` | Storage connection string for uploads (avatars, KYC documents). |
| `METRICS_TOKEN` | `string` | Bearer token to authorize Prometheus scraper requests on `/metrics`. |
| `SENTRY_DSN` | `string` | Sentry DSN URL for backend error capturing. |

### Docker Build & Run
The Dockerfile builds a optimized production image:
```bash
# Build the production image
docker build -t worksure-server:latest .

# Run the container locally or in staging
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  worksure-server:latest
```

---

## 3. Frontend Deployment (`worksure-ui`)

The frontend is a Next.js application that can be deployed to Vercel, Netlify, or self-hosted via Docker.

### Production Environment Variables
| Variable | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `string` | Public URL of the frontend proxy (e.g., `https://worksure.dev`). |
| `BACKEND_API_URL` | `string` | **Server-side only** URL pointing to the NestJS backend (e.g., `https://api.worksure.dev`). |
| `NEXTAUTH_SECRET` | `string` | Encryption key for frontend JWT/session management. |

### BFF Cookie and Proxy Coordination
The frontend forwards client requests to the backend through a server-side proxy route: `/api/proxy/[...path]`.
1. The client browser communicates *only* with the Next.js domain.
2. Next.js appends the `httpOnly`, `Secure`, `SameSite=Strict` cookie containing the session token.
3. Next.js signs the header and forwards the request server-to-server to the NestJS API.
4. **Crucial**: Ensure `ALLOWED_ORIGINS` on the backend contains the exact origin of the Next.js frontend to allow CORS pre-flight authorization for direct WebSocket handshakes.

---

## 4. Database Setup & Migrations

Every deployment executing schema modifications must run Prisma migrations.
```bash
# Apply pending migrations linearly on the production database
npx prisma migrate deploy
```
*Note: Do not run `prisma migrate dev` in production as it can trigger schema resets and data loss.*

---

## 5. Paystack Webhook Coordination

To receive webhook alerts for payment completions and payouts:
1. Log in to the Paystack Dashboard.
2. Navigate to **Settings > API Keys & Webhooks**.
3. Set the webhook URL to: `https://<your-backend-domain>/payments/paystack/webhook`.
4. Copy the webhook secret key and add it as `PAYSTACK_WEBHOOK_SECRET` in the backend environment configuration.
