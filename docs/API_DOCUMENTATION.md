# WorkSure Developer API Documentation

This guide describes how to authenticate and interface with the WorkSure backend API service.

---

## 1. Authentication Architecture

WorkSure uses a decoupled authentication strategy across the frontend (`worksure-ui`) and backend (`worksure-server`) repositories.

### Client-side API Calls (via BFF)
The client browser never sees the backend JWT. Instead:
1. The browser requests `/api/proxy/*` on the frontend Next.js server.
2. Next.js retrieves the `httpOnly` secure session cookie and signs a standard `Authorization: Bearer <JWT>` header.
3. Next.js forwards this request server-to-server to the NestJS API.

### Direct API Calls (e.g. Admin or Mobile Client)
Include the JWT token directly in the request headers:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. Key API Endpoints

### 2.1 Authentication & Registration

#### `POST /auth/register`
Creates a new user account.
- **Payload**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@worksure.dev",
    "password": "SecurePassword123!",
    "role": "CLIENT" // or "ARTISAN"
  }
  ```
- **Validation Rules**:
  - `password` must be at least 6 characters, contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character.

#### `POST /auth/login`
Logs in a user and returns their profile.
- **Payload**:
  ```json
  {
    "email": "jane.doe@worksure.dev",
    "password": "SecurePassword123!"
  }
  ```

---

### 2.2 Escrow & Contracts

#### `POST /contracts/:id/fund`
Allows a client to fund a contract to move it into the `IN_PROGRESS` state.
- **Authorization**: Required (Must be the contract client owner).
- **Process**: Initializes a transaction with Paystack and returns a payment URL for the client.

#### `POST /contracts/:id/complete`
Marks a contract as complete.
- **Artisan Request**: Indicates work is finished.
- **Client Request**: Approves work, triggers escrow release.
- **Process**: Payouts are calculated (deducting the artisan's specific platform fee) and queued as a BullMQ task.

---

### 2.3 Ledger Balance

#### `GET /wallet/balance`
Retrieves the real-time ledger balance for the authenticated user.
- **Response**:
  ```json
  {
    "balance": 150000, // Balance in kobo (NGN)
    "frozen": 0
  }
  ```

---

## 3. Real-Time Chat (WebSockets)

WebSocket connections are authenticated via purpose-scoped tokens.

1. Fetch a chat token via `POST /chat/token`.
2. Connect to the WebSocket namespace `/chat` sending the token in the auth handshake:
   ```javascript
   const socket = io('https://api.worksure.dev/chat', {
     auth: {
       token: 'eyJhbGciOiJIUzI1Ni...'
     }
   });
   ```

---

## 4. Exporting OpenAPI Schema

The backend is fully self-documenting. To export the latest OpenAPI configuration:
```bash
# Generate openapi.json file
npm run export:openapi
```
This generates `openapi.json` which can be loaded into Swagger UI or Postman.
Alternatively, spin up the backend server in development mode (`npm run start:dev`) and navigate to:
```text
http://localhost:8000/docs
```
to view the interactive API swagger playground.
