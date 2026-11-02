# 🧾 WorkSure Server — Backend

Escrow-based marketplace backend for connecting clients with artisans, built with **NestJS**, **Prisma**, and **PostgreSQL**, and powered by **Paystack** for payment orchestration.

---

## 🚀 Overview

WorkSure is a **trust-first marketplace system** where:
1. Clients post jobs
2. Artisans submit proposals
3. Accepted proposals become contracts
4. Clients fund contracts before work begins
5. Both parties confirm completion
6. Funds are released safely or refunded via dispute resolution

---

## 🧠 Core Architecture

The system follows a **state-machine-driven modular monolith** design.

### 🔑 Core Principle
> **Contracts define business truth. Payments execute money movement.**

### 🧩 System Layers

#### 1. State Engine → `contracts`
* Single source of truth for lifecycle
* Enforces all valid transitions
* No other module mutates contract state

#### 2. Settlement Engine → `payments`
* Handles Paystack integration
* Executes funding, payouts, and refunds
* Confirms outcomes via **webhooks**

#### 3. Data Integrity & Monitoring Layer
* `monitoring`: Automated background jobs (`DataPruningService`) to clean up old database logs (14-180 days).
* `reconciliation`: Automated financial ledger checks ensuring zero discrepancy between system balances and escrow accounts.
* Supports robust error-logging with "exception-only" DB persistence to optimize storage.

#### 4. Interaction Layer
* `jobs`, `proposals`, `chat`, `reviews`, `disputes`, `notifications`, `admin`
* Supports user workflows around contracts

---

## 🔁 Core System Loop

```text
User Action → Contracts (state) → Payments → Paystack → Webhook → Contracts (final state)
```

---

## 📦 Tech Stack

* **Core**: NestJS, TypeScript
* **Database**: PostgreSQL, Prisma ORM
* **Background Jobs**: `@nestjs/schedule` (Cron jobs)
* **Auth & Security**: JWT (`@nestjs/jwt`), bcrypt, helmet, class-validator
* **Payments**: Paystack API (transactions, transfers, refunds, webhooks)
* **Realtime & Media**: WebSockets (chat), Cloudinary (uploads)
* **Tooling**: Swagger (`/api`), Jest (testing), Docker

---

## ⚙️ Quick Start

### Prerequisites
* Node.js ≥ 22
* PostgreSQL 15+
* Redis (Render managed internal Redis service in production, or local Redis 7+)

### Install
```bash
npm install
```

### Environment Variables
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Populate required secrets (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PAYSTACK_SECRET`, `PAYSTACK_PUBLIC`, `PAYSTACK_WEBHOOK_SECRET`, `CLOUDINARY_*`).
*Note: In production on Render, Redis runs as an internal service on the private network (`redis://red-xxx:6379`), so TLS is bypassed automatically.*

### Database Setup
```bash
npx prisma generate
npx prisma migrate dev
```

### Run Server
```bash
npm run start:dev
```

### API Documentation
Once running, visit the Swagger UI: `http://localhost:3000/api`

---

## 🔒 Contract Lifecycle

```text
PENDING_PAYMENT → FUNDED → IN_PROGRESS → CLIENT_CONFIRMED → READY_FOR_PAYOUT → PAID_OUT | REFUNDED
```
**Critical Rule**: Only `ContractsService` can change contract state.

---

## 💸 Payment System

**Principle**: WorkSure does NOT hold funds — Paystack does.

* **Funding**: Initialize payment → Checkout → Webhook confirms → contract becomes `FUNDED`
* **Payout**: Contract reaches `READY_FOR_PAYOUT` → Transfer initiated → Webhook confirms → `PAID_OUT`
* **Refund**: Dispute/cancellation → Refund requested → Webhook confirms → `REFUNDED`

---

## 🧪 Testing

```bash
npm run test
npm run test:e2e
npm run test:cov
```
