# P2P Shipping — Implementation Trade-offs & Workarounds

This document records decisions made during the phased implementation (Phases 1–7) of the P2P Shipping feature on the Nzubia Global platform. It is intended for future maintainers and reviewers.

---

## Messaging: Room ID = Shipment ID

**Decision:** The chat thread for a P2P shipment uses the `shipmentId` UUID as the `room_id` in the `messages` table. The thread is created at `HANDOFF_PENDING` state and the ID is stored on `P2pShipmentRequest.chatThreadId`.

**Why:** The `MessagingService` is a simple room-based store with no concept of "creating a thread". Using the shipment ID makes the room deterministic and idempotent — calling `recordHandoff` twice produces the same room rather than a duplicate.

**Consequence:** Before handoff, the Flutter chat shortcut falls back to `shipment.id` as the room name. Messages sent before handoff will appear in the same room after handoff since the IDs are identical. This is acceptable for MVP.

**Future:** When a proper thread/conversation entity is added to `MessagingService`, migrate to a `getOrCreateThread(shipmentId)` method that returns an explicit thread record.

---

## Notifications: Fire-and-Forget via EmailService

**Decision:** All P2P notification emails are sent via `this.emailService.sendEmail(...).catch(...)`. Failures are logged but do not throw or roll back the business operation.

**Why:** Notification delivery is best-effort — a failed email should not block a seeker from accepting an offer or a courier from completing a handoff. This avoids distributed-transaction complexity at the MVP stage.

**Consequence:** If the email service is down, notifications are silently dropped. There is no retry queue.

**Future:** Introduce a durable outbox pattern or an event bus (e.g., BullMQ) to buffer notification payloads for at-least-once delivery.

---

## Notifications: No Push Notifications

**Decision:** All user notifications are email-only. The `SmsService` and any FCM/APNs layer are not wired into the P2P flow.

**Why:** The existing `NotificationsModule` exports only `EmailService` and `SmsService`. No FCM registration-token infrastructure exists in the Flutter app yet.

**Future:** When push tokens are stored per user, add a `PushNotificationService` and call it alongside `emailService.sendEmail` at the same notification points.

---

## Route Expiry: On-Demand Endpoint, Not a Cron Job

**Decision:** `RouteService.notifyExpiringRoutes()` is exposed as a `POST /p2p/routes/notify-expiring` endpoint rather than a NestJS scheduled task (`@Cron`).

**Why:** The `@nestjs/schedule` package was not in the project dependencies. Adding it would require dependency installation + `ScheduleModule.forRoot()` wiring. The endpoint-based approach lets an external scheduler (e.g., a Cloud Scheduler/cron job hitting the API) trigger the same logic without adding a new library.

**Consequence:** Routes will not be automatically notified — an operator or external cron must call the endpoint.

**Future:** Add `@nestjs/schedule` and convert to a `@Cron('0 8 * * *')` scheduled task so no external trigger is needed.

---

## Payments: Hold ≠ True Escrow

**Decision:** On `acceptOffer`, if `offerAmountUsd` is set, a Stripe `PaymentIntent` is created immediately and its ID stored in `P2pOffer.paymentReference`. The `payment_method` is not yet confirmed (no client-side Stripe.js step is wired for P2P).

**Why:** Full escrow requires a Stripe Payment Element on the client side to collect card details and confirm the intent. The Flutter checkout flow (`CheckoutScreen`) only covers the existing standard shipment quote flow. Wiring a parallel Stripe flow for P2P would duplicate that infrastructure.

**Consequence:** The intent is created but remains `requires_payment_method`. Funds are not actually held until the Flutter side confirms it with a payment method.

**TODO:** After the P2P Stripe flow is built in Flutter, call `stripe.confirmPayment` with the `clientSecret` returned by the backend. Until then, the `paymentReference` and `paymentStatus = PENDING` serve as a record for manual reconciliation.

---

## Payments: No Stripe Connect ID on User/Courier

**Decision:** `acceptOffer` passes `agentConnectId = undefined` to `PaymentsService.createPaymentIntent`, meaning no `transfer_data` is set on the Stripe intent.

**Why:** The `User` entity has no `stripeConnectId` field. Courier payouts via Stripe Connect require a separate onboarding flow (Connect OAuth or Custom account creation) that has not been built.

**Consequence:** Platform collects the full payment; courier payout must be triggered manually via `PaymentsService.releaseFunds`.

**TODO:** Add `stripeConnectId` to either `User` or `P2pCourierProfile` (preferred: courier-specific, since not all users are couriers). Pass it through to `createPaymentIntent` once couriers complete Connect onboarding.

---

## Platform Settings: Hardcoded Fallbacks

**Decision:** All `PlatformSettingsService` getters have hardcoded fallback values (e.g., `return 5000` if the DB row is missing or inactive).

**Why:** This prevents a cold-start failure if the `onModuleInit` seed hasn't run yet (e.g., during test teardown or DB migration).

**Consequence:** If an operator deletes a setting row instead of setting `is_active = false`, the hardcoded default silently takes effect without logging.

**Future:** Log a `WARN` when the fallback is hit so operators can detect misconfiguration.

---

## Flutter: `chatThreadId` Nullable Before Handoff

**Decision:** `P2pShipmentRequest.chatThreadId` is nullable in the Dart model. The detail screen chat icon button always renders but falls back to `shipment.id` as the room when the thread has not yet been created.

**Why:** The thread only exists after `HANDOFF_PENDING`. Hiding the button entirely until that state would reduce discoverability (users learn the button exists from the initial state).

**Consequence:** Tapping "Chat" before handoff will open an empty room under the shipment ID. Messages sent there will appear in the same room once handoff is recorded (same ID). This is a minor UX convenience that avoids a broken experience.

---

## Standard (Non-P2P) Shipment Flow

All changes are confined to the `p2p-shipping` module, the `platform-settings` service (additive getter methods + seed defaults), and the Flutter P2P model layer. The existing `shipments`, `quotes`, `payments`, and `tracking` flows are unchanged. The `PlatformSettingsModule` is `@Global()`, so no existing module import graph was altered.
