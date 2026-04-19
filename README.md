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

## Sequence Diagrams

This section describes the current end-to-end backend behavior for the main marketplace flows.

Core rule:

> Only `ContractsService` mutates contract status.
> Paystack confirms money movement asynchronously through webhook calls handled by `PaymentsController`.

Implementation note:

- The diagrams below are aligned to the current codebase.
- Participants labeled `Events` represent domain milestones and follow-on side effects conceptually.
- The backend does not yet have a centralized event bus; most side effects are still direct service calls or future-facing architecture markers.

### 1. Proposal Acceptance -> Contract Creation

In the current backend, accepting a proposal and creating a contract are two separate actions.

```mermaid
sequenceDiagram
    participant Client
    participant ProposalsController
    participant DB
    participant ContractsController
    participant ContractsService

    Client->>ProposalsController: Accept Proposal
    ProposalsController->>DB: update Proposal (ACCEPTED)
    ProposalsController-->>Client: Proposal accepted

    Client->>ContractsController: Create Contract from accepted proposal
    ContractsController->>ContractsService: createContract(proposalId, userId)
    ContractsService->>DB: create Contract (PENDING_PAYMENT)
    ContractsService-->>ContractsController: contract
    ContractsController-->>Client: Contract created
```

### 2. Contract Funding (Paystack Checkout + Webhook)

```mermaid
sequenceDiagram
    participant Client
    participant PaymentsController
    participant PaymentsService
    participant Paystack
    participant ContractsService
    participant DB

    Client->>PaymentsController: Fund Contract
    PaymentsController->>PaymentsService: initializeContractPayment(contractId)
    PaymentsService->>DB: create Payment (PENDING)
    PaymentsService->>Paystack: POST /transaction/initialize
    Paystack-->>PaymentsService: authorization_url, access_code, reference
    PaymentsService->>DB: update Payment + Contract payment reference data
    PaymentsController-->>Client: checkout URL

    Client->>Paystack: complete payment
    Paystack->>PaymentsController: charge.success webhook
    PaymentsController->>PaymentsService: processPaystackWebhook(payload)
    PaymentsService->>Paystack: verify transaction reference
    PaymentsService->>DB: mark Payment completed + create Transaction(PAYMENT)
    PaymentsService->>ContractsService: markFunded(contractId)
    ContractsService->>DB: update Contract (FUNDED)
```

### 3. Work Progress -> Completion -> Ready For Payout

```mermaid
sequenceDiagram
    participant Client
    participant Artisan
    participant ContractsController
    participant ContractsService
    participant DB

    Client->>ContractsController: Confirm Completion
    ContractsController->>ContractsService: confirmCompletion(contractId, isClient=true)
    ContractsService->>DB: update Contract (CLIENT_CONFIRMED)
    ContractsController-->>Client: Client confirmation recorded

    Artisan->>ContractsController: Confirm Completion
    ContractsController->>ContractsService: confirmCompletion(contractId, isClient=false)
    ContractsService->>DB: update Contract (READY_FOR_PAYOUT)
    ContractsController-->>Artisan: Contract ready for payout
```

### 4. Payout to Artisan (Transfer Flow)

```mermaid
sequenceDiagram
    participant Client
    participant ContractsController
    participant PaymentsService
    participant Paystack
    participant PaymentsController
    participant ContractsService
    participant DB

    Client->>ContractsController: Release Escrow
    ContractsController->>PaymentsService: releaseEscrow(contractId, userId)
    PaymentsService->>ContractsService: assertReadyForPayout(contractId)
    PaymentsService->>Paystack: POST /transferrecipient (if needed)
    PaymentsService->>Paystack: POST /transfer
    PaymentsService->>DB: create Transaction (TRANSFER, PENDING)
    ContractsController-->>Client: Payout initiated

    Paystack->>PaymentsController: transfer.success webhook
    PaymentsController->>PaymentsService: processPaystackWebhook(payload)
    PaymentsService->>DB: mark transfer transaction completed
    PaymentsService->>ContractsService: markPaidOut(contractId)
    ContractsService->>DB: update Contract (PAID_OUT)
```

### 5. Dispute -> Resolution (Refund or Admin Payout)

```mermaid
sequenceDiagram
    participant User
    participant DisputesController
    participant DisputesService
    participant Admin
    participant PaymentsService
    participant Paystack
    participant PaymentsController
    participant ContractsService
    participant DB

    User->>DisputesController: Open Dispute
    DisputesController->>DisputesService: createDispute()
    DisputesService->>DB: store dispute
    DisputesService->>ContractsService: markDisputed(contractId)
    ContractsService->>DB: update Contract (DISPUTED)

    Admin->>DisputesController: Resolve Dispute
    DisputesController->>DisputesService: updateDispute(...RESOLVED, decision)

    alt Refund Client
        DisputesService->>PaymentsService: refundContract(contractId, clientId, reason)
        PaymentsService->>Paystack: POST /refund
        PaymentsService->>DB: create Transaction (REFUND, PENDING)
        Paystack->>PaymentsController: refund.processed webhook
        PaymentsController->>PaymentsService: processPaystackWebhook(payload)
        PaymentsService->>ContractsService: markRefunded(contractId)
        ContractsService->>DB: update Contract (REFUNDED)
    else Pay Artisan
        DisputesService->>PaymentsService: releaseEscrowByAdmin(contractId, reason)
        PaymentsService->>Paystack: POST /transfer
        PaymentsService->>DB: create Transaction (TRANSFER, PENDING)
        Paystack->>PaymentsController: transfer.success webhook
        PaymentsController->>PaymentsService: processPaystackWebhook(payload)
        PaymentsService->>ContractsService: markPaidOut(contractId)
        ContractsService->>DB: update Contract (PAID_OUT)
    end

    DisputesService->>DB: update Dispute (RESOLVED)
```

### 6. Review Submission

```mermaid
sequenceDiagram
    participant Client
    participant ReviewsController
    participant DB

    Client->>ReviewsController: Submit Review
    ReviewsController->>DB: load Contract + participants
    Note over ReviewsController: Contract must be COMPLETED or PAID_OUT
    ReviewsController->>DB: store Review
    ReviewsController-->>Client: success
```

### Key Observations

1. Contract state is centralized.
   `ContractsService` is the only service that changes contract status.

2. Payments are asynchronous.
   Funding, payout, and refund are only finalized after Paystack webhook confirmation.

3. Disputes decide outcomes, but `PaymentsService` executes money movement.

4. The current backend already models domain milestones clearly, but side effects are not yet driven by a dedicated event bus.

### Mental Model

```text
Action -> Contracts or Disputes -> Payments (if needed) -> Paystack webhook -> Contracts final state
```

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
