Global Logistics Marketplace: Project Overview & Core Flows

Document Version: 1.1
Date: December 5, 2025
Audience: Stakeholders, Product Managers, Design, and Engineering Leads

1. Executive Summary

The Global Logistics Marketplace is a three-sided digital platform designed to digitize and streamline the international freight process. It connects US-based Exporters (Customers) directly with vetted International Logistics Agents (Merchants) via a reliable, transparent, and secure escrow system.

Core Objectives:

Provide Exporters with instant, competitive quotes and end-to-end tracking.

Provide Agents with a scalable channel for securing new business.

Ensure compliance and security through Admin-controlled KYC/Escrow mechanisms.

2. System Architecture

The platform operates on a central API model connecting three distinct user interfaces.

A. The Ecosystem and Clients

Client

Technology

Primary User

Core Functionality

Mobile App (Customer)

Flutter

Exporter (Customer)

Shipment Booking, Quote Comparison, Payment, Real-Time Tracking, Chat.

Web Portal

Next.js

Agent (Merchant) / Admin (Superuser)

RFQ Management, Quoting Tool, Order Fulfillment, KYC Verification, Finance.

Central API

NestJS (Node.js)

All Clients

Business Logic, Database Interaction, Real-Time Communication (WebSockets), Payments (Stripe), Document Storage (S3).

3. Core User Flows (E2E Journeys)

3.1 Flow 1: User Onboarding and Verification

This flow secures the platform by validating both Exporter (Customer) and Agent (Merchant) identities and business credentials.

Steps:

Registration: User provides basic info (Email, Phone) via Mobile App (Customer) or Web Portal (Agent).

Role Assignment: The system determines the user's role (CUSTOMER or AGENT).

OTP Verification: Phone number is validated immediately via SMS.

KYC/KYB Submission (Agent): Agents must upload business licenses, insurance certificates, and tax ID documents.

Admin Review Gate: Agent profiles are placed in the PENDING queue in the Admin Web Portal.

Admin Action: An Admin verifies the documents.

Success: Status changes to VERIFIED. Agent is activated.

Failure: Status changes to REJECTED. Agent is notified with rejection reasons.

Key Data Points: users.role, users.kyc_documents, users.verification_status.

3.2 Flow 2: Customer Shipment & Quote Journey

The process from Request for Quote (RFQ) creation to final booking and payment.

Steps:

RFQ Creation (Customer App): Customer defines Origin/Destination, Cargo details (dimensions, weight, photos), and Service Level (Air/Sea).

RFQ Broadcast (Backend): The NestJS API saves the shipment record (status: REQUESTED) and notifies all eligible Agents (based on service regions).

Quote Submission (Agent Portal): Agents view the RFQ on their Job Board, use the Quote Calculator, and submit a quote via API.

Quote Comparison (Customer App): Customer views all quotes, comparing total price, ETA, and Agent rating.

Acceptance & Payment: Customer selects a quote.

Payment is Authorized and Captured (Stripe) into the platform's Escrow account.

shipment.status changes to BOOKED.

Key Data Points: shipments, quotes, transactions.status (HELD_IN_ESCROW).

3.3 Flow 3: Agent Order Fulfillment & Escrow Release

The operational part of the service, culminating in the release of funds to the Agent.

Steps:

Order Assignment: The Agent manages the order (status: BOOKED) in their Kanban board.

Document Check: The Agent verifies the Customer has uploaded required documents (Invoice, Packing List) before moving the order to the next stage.

Status Updates: The Agent uses the Web Portal to push status changes (e.g., PICKED_UP, IN_TRANSIT, CUSTOMS, DELIVERED). Each update is a PUT API call.

Proof: The PICKED_UP and DELIVERED updates require mandatory photo/signature proof submission via the API.

Automated Payout (Escrow Release):

Trigger 1 (Optional): 50% of funds are released upon PICKED_UP status with verified proof.

Trigger 2 (Final): Remaining 50% is released upon DELIVERED status with final proof.

Customer Notification: The Customer is notified of every status change and the final delivery via the Mobile App.

Key Data Points: shipments.status, transactions.amount, transactions.status (RELEASED).

3.4 Flow 4: Admin Oversight, Finance, and Disputes

The administrative lifecycle of compliance and financial control.

Steps:

KYC Management: Reviewing and approving new Agent applications (as detailed in Flow 1).

Financial Oversight: Monitoring the total volume of funds in HELD_IN_ESCROW and managing manual payout releases if needed.

Dispute Escalation:

If a Customer or Agent flags an issue, the related transaction is moved to FROZEN status.

The Admin uses the Unified Inbox to join the Customer-Agent chat thread for mediation.

Admin performs a final resolution and manually triggers a RELEASED or REFUNDED transaction status.

Key Data Points: users.verification_status, transactions.status, support_tickets.

4. Communication Hub (Real-Time Messaging)

A critical component linking all user roles via a real-time WebSocket Gateway (NestJS).

Conversation Type

Users Involved

Client Used

Trigger

Shipment Chat

Customer ↔ Agent

Mobile App ↔ Web Portal

Activated upon shipment.status becoming BOOKED.

Support Chat

Agent ↔ Admin

Web Portal ↔ Web Portal

Initiated by Agent via "New Support Ticket" action.

Dispute Mediation

Customer ↔ Agent ↔ Admin

All

Triggered when Admin joins a Shipment Chat or takes over a Support Ticket.

5. Technical Stack Summary

Layer

Framework/Technology

Runtime/Database

Purpose

Backend

NestJS (TypeScript)

Node.js

Core API, Business Logic, WebSockets.

Database

MySQL



Transactional, Relational Data Storage.

Mobile Client

Flutter

Dart

Cross-platform Customer App.

Web Client

Next.js (React)

TypeScript

Agent/Admin Portal with RBAC.

Payments

Stripe API



Escrow Management, Authorization, and Payouts.