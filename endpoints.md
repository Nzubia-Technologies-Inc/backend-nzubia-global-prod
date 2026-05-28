# NZUBIA Backend API Documentation

**Base URL**: `http://localhost:3000/api/v1`
**WebSocket URL**: `ws://localhost:3000`

---

## 1. Authentication (`/auth`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | No | Register new user | `{ email, password, phone?, business_name?, tax_id? }` |
| `POST` | `/auth/verify-otp` | No | Verify account | `{ email, otp }` |
| `POST` | `/auth/login` | No | Login (Get JWT) | `{ email, password }` |
| `POST` | `/auth/forgot-password` | No | Request Reset Code | `{ email }` |
| `POST` | `/auth/reset-password` | No | Reset Password | `{ email, otp, newPassword }` |
| `POST` | `/auth/change-password` | **Yes** | Change Password | `{ oldPassword, newPassword }` |
| `GET` | `/auth/google` | No | Google Sign-In | Redirects to Google |

---

## 2. Users & Agents (`/users`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users/profile` | **Yes** | Get own profile | Returns extensive User & AgentProfile data |
| `PATCH` | `/users/profile` | **Yes** | Update profile | `{ phone, address: { street, city... }, ... }` |
| `POST` | `/users/agent/onboarding` | **Yes** | Submit Agent KYC | `{ company_name, license_number, insurance_certificate_url, cargo_specializations: [], ... }` |
| `GET` | `/users/admin/pending-agents` | **Admin** | List pending KYC | - |
| `PATCH` | `/users/admin/verify/:id` | **Admin** | Approve Agent | - |

---

## 3. Platform Settings (`/platform-settings`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/platform-settings` | **Yes** | List all settings | Admin/Internal |
| `GET` | `/platform-settings/:key` | **Yes** | Get setting by key | e.g. `COMMISSION_RATE` |
| `PATCH` | `/platform-settings/:key` | **Admin** | Update setting | `{ value: "5.0", description? }` |

---

## 4. Shipments (`/shipments`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/shipments` | **Yes** | Create Shipment (RFQ) | `{ origin, destination, cargo_meta, service_level (EXPRESS/STANDARD/ECONOMY), additional_services: { insurance: true... } }` |
| `GET` | `/shipments` | **Yes** | List Shipments | Query: `?status=PENDING` |
| `GET` | `/shipments/:id` | **Yes** | Get Shipment Details | - |
| `PATCH` | `/shipments/:id` | **Yes** | Update Shipment | `{ status }` (Triggers Email to Customer) |
| `GET` | `/shipments/track/:id` | **No** | Public Tracking | Returns sanitized status info |

---

## 5. Quotes (`/quotes`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/quotes` | **Agent** | Submit Quote | `{ shipmentId, amount, currency, estimated_delivery_date, breakdown: { base_charge, customs_fee... } }` |
| `GET` | `/quotes` | **Yes** | List Quotes | Query: `?shipmentId=...` |
| `PATCH` | `/quotes/:id/accept` | **Yes** | Accept Quote | Changes status to `ACCEPTED` |
| `PATCH` | `/quotes/:id/reject` | **Yes** | Reject Quote | Changes status to `REJECTED` |

---

## 6. Documents (`/documents`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/documents` | **Yes** | Upload Doc Metadata | `{ type, url, shipmentId? }` |
| `GET` | `/documents` | **Yes** | List Documents | Query: `?shipmentId=...` |

---

## 7. Files (Uploads) (`/files`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/files/upload` | **Yes** | Upload File to GCS | `multipart/form-data`: field `file` |

---

## 8. Payments (`/payments`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/payments/create-intent` | **Yes** | Create Stripe Payment | `{ amount, currency, agentId }` - **Fee calculated dynamically** |
| `POST` | `/payments/webhook` | No | Stripe Webhook | Managed by Stripe |

---

## 9. Reviews (`/reviews`)

| Method | Endpoint | Secured | Description | Body / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/reviews` | **Yes** | Submit Review | `{ rating (1-5), comment, agentId, shipmentId }` |
| `GET` | `/reviews` | No | List Reviews | Query: `?agentId=...` |

---

## 10. Real-Time Chat (WebSocket)

**Namespace**: `/chat`
**Connection**: `ws://localhost:3000/chat`

| Event | Direction | Description | Payload |
| :--- | :--- | :--- | :--- |
| `joinRoom` | Client -> Server | Join a chat room | `ROOM_ID` (string) |
| `sendMessage` | Client -> Server | Send message | `{ "roomId": "...", "message": "...", "senderId": "..." }` |
| `newMessage` | Server -> Client | Receive message | `{ "roomId", "message", "senderId" }` |

*Note: History is automatically saved to the database.*

---

## 11. Data Types & Enums

**User Roles**: `CUSTOMER`, `AGENT`, `ADMIN`
**Shipment Status**: `PENDING`, `QUOTED`, `BOOKED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`
**Service Level**: `EXPRESS`, `STANDARD`, `ECONOMY`
