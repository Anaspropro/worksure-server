# 📄 IMPLEMENTATION.md — WorkSure Escrow Marketplace

---

# 🧠 1. System Overview

WorkSure is a **trust-first escrow marketplace** that connects clients with artisans.

The system ensures **secure transactions** by:

* Requiring clients to **fund contracts upfront**
* Holding funds securely via Paystack
* Releasing funds **only after job completion is confirmed**

> ⚠️ The platform does NOT directly hold user funds.
> All payments are processed and managed via Paystack APIs.

---

# 🏗️ 2. Core Architecture

---

## Backend Stack

* **Framework:** NestJS
* **ORM:** Prisma
* **Database:** PostgreSQL
* **Auth:** JWT + Session store (Postgres or Redis)
* **Payments:** Paystack
* **Storage:** Cloudinary (media)

---

## Core Modules

```text
src/modules/
├── auth/
├── users/
├── kyc/
├── jobs/
├── proposals/
├── contracts/
├── escrow/
├── payments/
├── wallet/
├── chat/
├── disputes/
├── admin/
```

---

# 👥 3. User Roles

---

## Client

* Create jobs
* Accept proposals
* Fund contracts
* Confirm completion

---

## Artisan

* Complete KYC (including bank details)
* Submit proposals
* Execute jobs
* Receive payouts

---

## Admin

* Monitor system activity
* Handle disputes
* Oversee transactions
* Enforce compliance

> ❗ Admin does NOT manually transfer funds
> All payouts are triggered via Paystack APIs

---

# 🔄 4. Core System Flow

---

## 🟢 Step 1: Job Creation

* Client creates job
* Artisan submits proposal

---

## 🟡 Step 2: Contract Creation

* Client accepts proposal
* Contract is created:

```ts
Contract {
  id
  clientId
  artisanId
  amount
  status: PENDING | FUNDED | IN_PROGRESS | COMPLETED | RELEASED | DISPUTED
}
```

---

## 🔒 Step 3: Payment (Escrow Funding)

---

### Frontend

* Initialize Paystack payment
* Send `reference` to backend

---

### Backend

* Verify payment via webhook

```ts
POST /payments/paystack/webhook
```

---

### On Success:

```ts
Transaction.status = "FUNDED"
Escrow.status = "FUNDED"
Contract.status = "FUNDED"
```

---

## ⚠️ RULE

* NEVER trust frontend payment success
* ALWAYS verify via Paystack webhook

---

## 🟠 Step 4: Work Execution

* Artisan performs job
* Communication via chat
* Media uploads (Cloudinary)

---

## 🟣 Step 5: Completion Flow

---

### Client:

```ts
POST /contracts/:id/complete
```

---

### Artisan:

```ts
POST /contracts/:id/confirm
```

---

## 💰 Step 6: Payment Release

---

### Trigger Conditions:

* Client marked complete
* Artisan confirmed

---

### Backend:

```ts
POST /payments/release
```

---

### Logic:

1. Validate contract state
2. Calculate commission
3. Trigger Paystack transfer

---

### Paystack Transfer:

```json
{
  "source": "balance",
  "amount": artisanAmount,
  "recipient": artisanSubaccount
}
```

---

### Update:

```ts
Escrow.status = "RELEASED"
Transaction.status = "RELEASED"
```

---

# 🔁 5. Dispute Flow

---

## Trigger

```ts
POST /disputes
```

---

## Flow

1. Client raises dispute
2. Admin reviews:

   * Chat logs
   * Uploaded proof

---

## Resolution

* Release payment
  OR
* Refund client

---

### Refund:

```ts
POST /payments/refund
```

---

# 🪪 6. KYC System

---

## Artisan KYC Data

* Full name
* Phone
* Bank account details

---

## Storage

* Encrypted sensitive fields
* Linked to user

---

## Validation

* Artisan must be verified before payout

---

# 💰 7. Payment Module

---

## Responsibilities

* Initialize payments
* Verify via webhook
* Handle escrow state
* Trigger payouts
* Process refunds

---

## Required Endpoints

```ts
POST /payments/initialize
POST /payments/paystack/webhook
POST /payments/release
POST /payments/refund
```

---

## Security Rules

* Verify webhook signature (HMAC SHA512)
* Use idempotency keys
* Prevent duplicate payouts

---

# 🔐 8. Authentication & Sessions

---

## Requirements

* JWT authentication
* Session persistence (Postgres or Redis)
* Session invalidation on password reset

---

## MUST FIX (from audit)

* ❌ No in-memory session store
* ❌ No fallback JWT secret

---

# ⚠️ 9. Critical Security Requirements

---

## MUST IMPLEMENT

* Webhook verification
* Payment ownership checks
* Role-based access control
* Secure password policy
* Sensitive data redaction in logs

---

## Payment Authorization Check

```ts
if (payment.userId !== currentUser.id) {
  throw new ForbiddenException();
}
```

---

# 🧱 10. Database Design (Core Models)

---

## User

```ts
User {
  id
  email
  password
  role
  isVerified
}
```

---

## Contract

```ts
Contract {
  id
  clientId
  artisanId
  amount
  status
}
```

---

## Transaction

```ts
Transaction {
  id
  contractId
  amount
  status
  paystackRef
}
```

---

## Escrow

```ts
Escrow {
  id
  contractId
  status
}
```

---

# ⚙️ 11. System Rules (VERY IMPORTANT)

---

## Payments

* Platform does NOT hold funds
* Paystack handles all money

---

## Escrow

* Controlled via contract state
* Not a wallet balance

---

## Admin

* Cannot create contracts
* Cannot trigger arbitrary payouts
* Only resolves disputes

---

# 🚀 12. Implementation Phases

---

## Phase 1 (MVP)

* Auth
* Jobs & proposals
* Contracts
* Paystack payment + webhook
* Basic escrow logic

---

## Phase 2

* Payouts
* Commission logic
* Chat system

---

## Phase 3

* Disputes
* Admin dashboard
* Audit logs

---

# 🎯 13. Key Principles

---

## 🔒 Security First

* Never trust client input
* Always verify payment

---

## 💰 Financial Integrity

* Use FSM for contract states
* Prevent double payouts

---

## ⚖️ Compliance

* Do not hold funds directly
* Use Paystack as intermediary

---

# ✅ FINAL NOTE

This system is designed to be:

* Secure
* Scalable
* Compliance-aware
* Production-ready

---

# 📄 PAYMENT_MODULE.md — WorkSure

---

# 🧠 1. Module Responsibility

The Payment Module is responsible for:

* Initializing payments (client → Paystack)
* Verifying payments (via webhook)
* Managing escrow state transitions
* Releasing funds to artisans
* Processing refunds
* Enforcing financial integrity (idempotency, authorization, audit logs)

> ⚠️ The platform does NOT store or hold funds.
> All funds are processed via Paystack.

---

# 🏗️ 2. Module Structure

```text
src/modules/payments/
├── payments.controller.ts
├── payments.service.ts
├── paystack.service.ts
├── dto/
│   ├── initialize-payment.dto.ts
│   ├── verify-payment.dto.ts
│   ├── release-payment.dto.ts
│   ├── refund.dto.ts
├── interfaces/
│   ├── paystack-webhook.interface.ts
├── guards/
│   ├── payment-ownership.guard.ts
```

---

# 🧾 3. Database Models (Prisma)

---

## Transaction

```prisma
model Transaction {
  id            String   @id @default(uuid())
  contractId    String
  clientId      String
  artisanId     String
  amount        Int
  currency      String   @default("NGN")
  paystackRef   String   @unique
  status        TransactionStatus
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  contract Contract @relation(fields: [contractId], references: [id])
}
```

---

## Escrow

```prisma
model Escrow {
  id          String   @id @default(uuid())
  contractId  String   @unique
  status      EscrowStatus
  fundedAt    DateTime?
  releasedAt  DateTime?
}
```

---

## IdempotencyKey

```prisma
model IdempotencyKey {
  id        String   @id @default(uuid())
  key       String   @unique
  createdAt DateTime @default(now())
}
```

---

## Enums

```prisma
enum TransactionStatus {
  PENDING
  FUNDED
  RELEASED
  REFUNDED
}

enum EscrowStatus {
  AWAITING_PAYMENT
  FUNDED
  IN_PROGRESS
  COMPLETED
  RELEASED
  DISPUTED
}
```

---

# 🔄 4. Payment Flow (Detailed)

---

# 🟢 4.1 Initialize Payment

---

## Endpoint

```http
POST /payments/initialize
```

---

## Request

```json
{
  "contractId": "uuid"
}
```

---

## Flow

1. Validate user is contract owner (client)
2. Fetch contract
3. Ensure contract is `PENDING`
4. Generate Paystack reference
5. Save transaction (PENDING)
6. Return Paystack payment link

---

## Service Logic

```ts
const reference = generateReference();

await prisma.transaction.create({
  data: {
    contractId,
    clientId: user.id,
    artisanId: contract.artisanId,
    amount: contract.amount,
    paystackRef: reference,
    status: "PENDING",
  },
});
```

---

## Call Paystack

```ts
POST https://api.paystack.co/transaction/initialize
```

---

# 🔒 4.2 Webhook Verification (CRITICAL)

---

## Endpoint

```http
POST /payments/paystack/webhook
```

---

## Requirements

* Public route
* Raw body required
* Verify signature

---

## Signature Verification

```ts
const hash = crypto
  .createHmac("sha512", PAYSTACK_SECRET)
  .update(rawBody)
  .digest("hex");

if (hash !== signature) throw new UnauthorizedException();
```

---

## Handle Event

```json
{
  "event": "charge.success",
  "data": {
    "reference": "abc123"
  }
}
```

---

## Logic

1. Check idempotency
2. Find transaction by `reference`
3. Ensure not already processed
4. Update:

```ts
Transaction.status = "FUNDED"
Escrow.status = "FUNDED"
Contract.status = "FUNDED"
```

5. Record `fundedAt`

---

# ⚠️ RULE

* NEVER trust frontend success
* ONLY trust webhook

---

# 🟣 4.3 Release Payment

---

## Endpoint

```http
POST /payments/release
```

---

## Access

* System-triggered OR
* Admin (only for dispute resolution)

---

## Preconditions

* Contract status = COMPLETED
* Escrow status = COMPLETED
* Not already released

---

## Flow

1. Lock transaction row (`FOR UPDATE`)
2. Check idempotency
3. Calculate commission

---

## Example

```ts
const commission = amount * 0.1;
const payout = amount - commission;
```

---

## Call Paystack Transfer

```http
POST /transfer
```

```json
{
  "source": "balance",
  "amount": payout,
  "recipient": artisanRecipientCode,
  "reason": "WorkSure escrow payout"
}
```

---

## Update

```ts
Escrow.status = "RELEASED"
Transaction.status = "RELEASED"
```

---

# 🔁 4.4 Refund Flow

---

## Endpoint

```http
POST /payments/refund
```

---

## Access

* Admin only

---

## Flow

1. Validate dispute
2. Confirm transaction is FUNDED
3. Call Paystack refund API

---

```http
POST /refund
```

---

## Update

```ts
Transaction.status = "REFUNDED"
Escrow.status = "DISPUTED"
```

---

# 🔐 5. Security Requirements

---

## MUST IMPLEMENT

---

### 1. Payment Ownership Check

```ts
if (transaction.clientId !== user.id) {
  throw new ForbiddenException();
}
```

---

### 2. Idempotency

Prevent:

* Duplicate webhook processing
* Double payout

---

### 3. Row-Level Locking

```sql
SELECT * FROM Transaction WHERE id = ? FOR UPDATE;
```

---

### 4. Audit Logging

Log:

* who triggered release
* timestamp
* amount

---

### 5. Webhook Deduplication

Use `IdempotencyKey` table:

```ts
if (exists(key)) return;
```

---

# ⚙️ 6. Paystack Service

---

## Responsibilities

* Initialize payment
* Verify transaction
* Transfer funds
* Refund

---

## Required Methods

```ts
initializeTransaction()
verifyTransaction()
createTransferRecipient()
initiateTransfer()
refundTransaction()
```

---

# 🪪 7. KYC Integration

---

## Artisan MUST have:

* Verified bank account
* Paystack recipient code

---

## Before payout:

```ts
if (!artisan.isVerified) {
  throw new ForbiddenException();
}
```

---

# ⚠️ 8. Critical Rules

---

## ❌ NEVER

* Store money locally
* Trigger payout without validation
* Skip webhook verification

---

## ✅ ALWAYS

* Use Paystack APIs
* Verify ownership
* Enforce contract state

---

# 🚀 9. Error Handling

---

## Handle:

* Paystack downtime
* Duplicate webhook
* Invalid references
* Transfer failure

---

## Retry Strategy

* Queue failed payouts
* Retry with exponential backoff

---

# 📊 10. Observability

---

Track:

* total funded transactions
* successful payouts
* failed payouts
* refund rate

---

# 🎯 11. Final Notes

---

This module must guarantee:

* Financial integrity
* Idempotency
* Security
* Compliance


