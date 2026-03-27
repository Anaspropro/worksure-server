# 🛠️ Backend Engineering Specification

## Project: Escrow-Based Artisan Marketplace API

---

## 1. 📌 Overview

This backend system powers an escrow-based digital marketplace that connects **clients** with **artisans**.

The platform enables:

* Job posting and bidding
* Agreement formation via contracts
* Secure escrow-based payments
* Controlled release of funds upon task completion
* Platform fee deduction per transaction

The backend is responsible for:

* Business logic enforcement
* Payment and escrow integrity
* Data persistence
* Authentication and authorization

---

## 2. 🧠 Core System Concept

The system operates on a **trust-based escrow workflow**:

1. Client posts a job with a budget
2. Artisans submit proposals
3. Client selects an artisan
4. A contract is created
5. Client funds the contract (money held in escrow)
6. Artisan completes the job
7. Client confirms completion
8. Artisan acknowledges completion
9. System releases payment:

   * Artisan receives payment minus platform fee
   * Platform earns percentage fee

---

## 3. 🏗️ Architecture Style

* **Framework:** NestJS
* **ORM:** Prisma
* **Database:** PostgreSQL
* **Architecture:** Modular Monolith
* **Design Pattern:** Service-oriented modular structure

Each domain is implemented as an isolated module with its own service.

server/
│
├── src/
│   ├── modules/
|   |   ├── admin/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── artisan/
│   │   ├── jobs/
│   │   ├── proposals/
│   │   ├── contracts/
│   │   ├── wallet/
│   │   ├── payments/
│   │   ├── reviews/
│   │   ├── disputes/
│   │   ├── notifications/
│   │
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │
│   ├── prisma/  
│   │
│   ├── config/
│   │
│   └── main.ts
│
├── package.json
└── README.md

---

## 4. 📦 Core Modules

## 4.1 Auth Module

Handles authentication and authorization.

### Responsibilities

* User registration
* Login
* JWT token generation
* Password hashing and validation

---

## 4.2 Users Module

Manages base user data.

### Responsibilities

* Create and retrieve users
* Update profile
* Role assignment (CLIENT, ARTISAN, ADMIN)

---

## 4.3 Artisan Module

Manages artisan-specific data.

### Responsibilities

* Create artisan profiles
* Store skills and bio
* Manage verification status

---

## 4.4 Jobs Module

Handles job lifecycle.

### Responsibilities

* Create job postings
* Update and delete jobs
* Fetch jobs with filters
* Manage job status

---

## 4.5 Proposals Module

Handles artisan applications to jobs.

### Responsibilities

* Submit proposal
* Fetch proposals per job
* Accept/reject proposal

### Important

Accepting a proposal must trigger contract creation.

---

## 4.6 Contracts Module (Core Domain)

### Responsibilities

* Create contract between client and artisan
* Store agreed price and job reference
* Manage contract lifecycle:

  * PENDING
  * ACTIVE
  * COMPLETED
  * DISPUTED

### Rules

* A job can have only one active contract
* Contract is required before any payment action

---

## 4.7 Wallet Module

### Responsibilities

* Maintain user balances
* Handle credits and debits
* Provide transaction history

### Rules

* Wallet balance must never be modified directly
* All changes must go through transactions

---

## 4.8 Payments Module (Critical System)

### Responsibilities

* Handle wallet funding
* Integrate payment gateway
* Manage escrow logic
* Release payments
* Deduct platform fees

### Payment Flow

#### Funding

* User initiates payment
* Payment verified
* Wallet credited

#### Escrow

* Funds moved from client wallet to escrow on contract activation

#### Release

* Triggered after dual confirmation
* Platform fee deducted
* Artisan wallet credited

---

## 4.9 Transactions System

Tracks all financial operations.

### Types

* FUND
* ESCROW
* RELEASE
* WITHDRAW
* FEE

### Rules

* Every balance change must create a transaction record
* Transactions must be immutable

---

## 4.10 Reviews Module

### Responsibilities

* Create reviews after job completion
* Store ratings and feedback

---

## 4.11 Disputes Module

### Responsibilities

* Handle conflict cases
* Store dispute details
* Allow admin resolution

---

## 4.12 Notifications Module (Optional Initial Scope)

### Responsibilities

* Emit system events
* Notify users of important actions

---

# 5. 🔄 Core Workflows

---

## 5.1 Job → Proposal → Contract Flow

1. Client creates job
2. Artisan submits proposal
3. Client accepts proposal
4. System creates contract
5. Contract status becomes ACTIVE

---

## 5.2 Escrow Flow

1. Client funds wallet
2. Client activates contract
3. Backend:

   * Debits client wallet
   * Creates ESCROW transaction

---

## 5.3 Completion Flow

1. Client marks job as completed
2. Artisan confirms completion

---

## 5.4 Payment Release Flow

Backend must:

1. Validate both confirmations
2. Calculate platform fee
3. Execute transaction:

   * Credit artisan wallet
   * Credit platform wallet
4. Mark contract as COMPLETED

---

## 5.5 Dispute Flow

1. User raises dispute
2. Admin reviews evidence
3. Admin decides outcome:

   * Refund client OR
   * Pay artisan

---

# 6. 🧾 Data Integrity Rules

* All financial operations must use **database transactions**
* No direct wallet updates without transaction logs
* Contract must exist before escrow
* Escrow must exist before release
* Release must happen only once per contract

---

# 7. 🔐 Security Requirements

* JWT-based authentication
* Role-based authorization
* Password hashing (bcrypt)
* Input validation using DTOs
* Secure payment verification

---

# 8. ⚙️ Technical Constraints

* Use Prisma for all database operations
* Use transactions for financial logic
* Keep services modular and loosely coupled
* Avoid circular dependencies between modules

---

# 9. 🧪 Testing Expectations

* Unit tests for services
* Integration tests for payment workflows
* Edge cases:

  * Double payment prevention
  * Unauthorized access
  * Invalid contract state transitions

---

# 10. 🚀 Future Scalability

The system should be designed to allow future extraction into microservices:

Potential services:

* Auth Service
* Payment Service
* Job Service
* Notification Service

---

# 11. 📌 Key Engineering Principles

* Single source of truth for financial data
* Strong consistency over eventual consistency (especially for payments)
* Explicit state transitions (no hidden logic)
* Clear separation of concerns across modules

---

# ✅ End Goal

The backend should function as a **secure, scalable, and reliable transaction system** that ensures:

* Trust between users
* Safe handling of money
* Clear and enforceable workflows
* Extensibility for future features
