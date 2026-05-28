Backend API Specification

Framework: NestJS
Runtime: Node.js
Database: MySQL
ORM: TypeORM (Recommended for strict SQL schemas) or Prisma

1. Architecture Overview

Architecture: Modular Monolith.

Pattern: Controller -> Service -> Repository -> Database.

Authentication: Passport.js (JWT Strategy).

Validation: class-validator DTOs.

Documentation: Swagger (OpenAPI).

Real-Time: WebSocket Gateway (@nestjs/platform-socket.io).

2. Database Schema (MySQL)

Tables & Relationships

1. users

id (UUID, PK)

email (VARCHAR, Unique)

password_hash (VARCHAR)

role (ENUM: 'CUSTOMER', 'AGENT', 'ADMIN')

kyc_status (ENUM: 'PENDING', 'VERIFIED', 'REJECTED')

created_at (TIMESTAMP)

2. agent_profiles (One-to-One with Users)

user_id (FK)

company_name (VARCHAR)

license_number (VARCHAR)

service_regions (JSON Array)

wallet_balance (DECIMAL)

3. shipments

id (UUID, PK)

customer_id (FK -> users)

origin (JSON: {lat, lng, address})

destination_country (VARCHAR)

status (ENUM: 'REQUESTED', 'QUOTED', 'BOOKED', 'PICKED_UP', 'DELIVERED')

cargo_meta (JSON: dimensions, weight, images)

4. quotes

id (UUID, PK)

shipment_id (FK -> shipments)

agent_id (FK -> users)

amount (DECIMAL)

platform_fee (DECIMAL)

is_accepted (BOOLEAN)

5. documents

id (UUID, PK)

shipment_id (FK)

type (ENUM: 'INVOICE', 'PACKING_LIST', 'BOL')

url (VARCHAR - S3 Link)

verification_status (ENUM: 'PENDING', 'APPROVED')

6. messages (NEW: Chat History Table)

id (UUID, PK)

shipment_id (FK -> shipments, nullable for support chats)

support_ticket_id (FK -> tickets, nullable for shipment chats)

sender_id (FK -> users)

content (TEXT)

timestamp (TIMESTAMP)

type (ENUM: 'TEXT', 'DOCUMENT_LINK')

7. support_tickets (NEW: Agent-Admin Chat Threads)

id (UUID, PK)

agent_id (FK -> users)

status (ENUM: 'OPEN', 'PENDING_ADMIN', 'RESOLVED')

subject (VARCHAR)

3. NestJS Module Structure

3.1 AuthModule

Guards: JwtAuthGuard, RolesGuard.

Strategy: Extract JWT from Header, validate signature, attach User to Request object.

Endpoints:

POST /auth/register: Hashes password using bcrypt.

POST /auth/login: Returns access_token.

3.2 ShipmentModule

Service Logic:

create(): Saves shipment, emits event shipment.created.

findAllForAgent(region): Filters shipments based on Agent's subscribed regions.

Events:

On shipment.created: Trigger NotificationService to alert relevant Agents.

3.3 PaymentModule (Stripe Integration)

Service Logic:

createPaymentIntent(quoteId):

Fetch Quote amount.

Call Stripe API to create intent.

Save intent ID to transactions table.

handleWebhook():

Listen for payment_intent.succeeded.

Update Shipment status to BOOKED.

Update Transaction status to HELD_IN_ESCROW.

3.4 MessagingModule (NEW: Real-Time Chat)

MessagingGateway (WebSocket):

Authorization: Guard to authenticate socket connection using JWT from query params or header.

Handle Connection: Joins the user to a private room based on their userId.

Events:

Listen: send_message (from clients)

Validate sender/recipient relationship (Must be linked via a Shipment or Support Ticket).

Persist message to messages table.

Broadcast message to recipient's room.

Emit: new_message (to clients)

MessagingController (REST for History):

GET /messages/shipment/:id: Retrieve chat history for a specific shipment.

GET /messages/support/:id: Retrieve chat history for a support ticket.

3.5 NotificationModule

Tech: Firebase Admin SDK (FCM) for Mobile Push, Nodemailer/SendGrid for Email.

Triggers:

New Quote -> Push to Customer.

New Message -> Push to recipient (unless actively viewing chat).

4. API Specification (Key Endpoints)

Customer

POST /shipments: Create new request.

GET /shipments/:id/quotes: List quotes for a shipment.

POST /quotes/:id/accept: Select agent.

Agent

GET /marketplace: Feed of available shipments.

POST /quotes: Submit a bid.

PATCH /shipments/:id/status: Update workflow (e.g., set to "IN_TRANSIT").

POST /support/ticket: Create a new Agent-Admin support ticket.

Admin

GET /admin/agents?status=PENDING: KYC queue.

POST /admin/agents/:id/approve: Update kyc_status.

GET /admin/support/tickets: View all open support tickets.

5. Development Setup

Docker: Provide docker-compose.yml for MySQL and Redis (for queues).

Environment: .env file structure.

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
JWT_SECRET=supersecret
STRIPE_SECRET_KEY=sk_test_...
AWS_ACCESS_KEY=...
# NEW: WebSocket Endpoint
WS_ENDPOINT=ws://localhost:3000/


Migrations: Use TypeORM CLI for schema migrations.