# HAL Integration Layer — Developer API Guide

**Version:** v1  
**Last Updated:** May 2026  
**Status:** Production

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Base URL & Environments](#3-base-url--environments)
4. [Authentication](#4-authentication)
5. [Request Format](#5-request-format)
6. [Response Format](#6-response-format)
7. [Idempotency](#7-idempotency)
8. [Rate Limiting](#8-rate-limiting)
9. [Endpoints](#9-endpoints)
   - [Ping — Test API Key](#91-ping--test-api-key)
   - [Ping — Verify Tenant Mapping](#92-ping--verify-tenant-mapping)
   - [Upsert Customer](#93-upsert-customer)
   - [Create Lead](#94-create-lead)
   - [Create Ticket](#95-create-ticket)
   - [Create Invoice](#96-create-invoice)
   - [Create Payment](#97-create-payment)
   - [Post Activity / Event](#98-post-activity--event)
10. [Error Reference](#10-error-reference)
11. [Scopes Reference](#11-scopes-reference)
12. [How Tenant Mapping Works](#12-how-tenant-mapping-works)
13. [Code Examples](#13-code-examples)
14. [Best Practices](#14-best-practices)
15. [Glossary](#15-glossary)

---

## 1. Introduction

The **HAL Integration Layer** is a versioned HTTP gateway that allows external applications to push business data into HAL — a unified ERP system. It is designed for:

- **SaaS platforms** (e.g. Qrunful, Samel) that want to sync their customers, leads, and orders into HAL automatically.
- **IoT devices and point-of-sale systems** that need to record payments and inventory events.
- **Third-party apps** (e.g. Baab Sayer) that generate support tickets or CRM activities.

### What you can do via the API

| Action | HAL module affected |
|---|---|
| Sync a customer | CRM Accounts + Finance Customers |
| Push a sales lead | CRM Leads |
| Open a support ticket | Tickets |
| Create an invoice | Finance (draft, ZATCA-compatible) |
| Record a payment | Finance Payments |
| Log a business event | CRM Activities / custom workflows |

### What you cannot do

- Read or query HAL data (read operations are not exposed in v1)
- Delete records
- Manage users, roles, or company settings
- Access data belonging to companies your API key is not installed for

---

## 2. Getting Started

### Step 1 — Request API access

Contact the HAL administrator. They will:

1. Open **Super Admin → التكاملات (Integrations)**
2. Create an **Integration App** for your platform, selecting the scopes you need
3. Copy the **API key** shown once — give it to you securely

### Step 2 — Add an installation

For each tenant/company pair you need to write data into, the HAL admin creates an **Installation**:

- **External Tenant ID** — the identifier your app uses for that customer (e.g. `restaurant-001`, `branch-cairo`)
- **HAL Company** — which company inside HAL that tenant maps to

You will receive the External Tenant ID to use in every request payload.

### Step 3 — Test the connection

```bash
curl https://<hal-domain>/api/v1/integrations/ping \
  -H "Authorization: Bearer <your-api-key>"
```

Expected response:

```json
{
  "ok": true,
  "app": {
    "id": "...",
    "slug": "your-app-slug",
    "status": "active",
    "scopes": ["customers:upsert", "invoices:create"]
  },
  "message": "Integration authentication is valid"
}
```

### Step 4 — Verify a tenant mapping

```bash
curl https://<hal-domain>/api/v1/integrations/ping/restaurant-001 \
  -H "Authorization: Bearer <your-api-key>"
```

Expected response:

```json
{
  "ok": true,
  "tenant": {
    "externalTenantId": "restaurant-001",
    "halCompanyId": "uuid-of-the-hal-company",
    "mapped": true
  },
  "message": "Tenant mapping verified"
}
```

If `mapped` is `false`, ask the HAL admin to create an installation for that tenant.

---

## 3. Base URL & Environments

```
Production:   https://<your-hal-domain>/api/v1/integrations
Development:  https://<your-hal-dev-domain>/api/v1/integrations
```

All paths in this document are relative to this base URL.  
Example: `POST /customers/upsert` → `POST https://<hal-domain>/api/v1/integrations/customers/upsert`

---

## 4. Authentication

Every request must carry your API key in the `Authorization` header:

```http
Authorization: Bearer hal_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Key format

HAL API keys follow the format `hal_live_` followed by 32 hex characters.

### Key behavior

- Keys are **scoped** — each key grants specific permissions (see [Scopes Reference](#11-scopes-reference))
- Keys are **hashed** server-side — if a key is lost, it cannot be recovered, only rotated
- A revoked key is rejected immediately with `401`
- Keys are **per app**, not per tenant — one key covers all tenants your app has installations for

### Error responses

| Situation | HTTP | Error code |
|---|---|---|
| No `Authorization` header | 401 | `INVALID_API_KEY` |
| Wrong or malformed key | 401 | `INVALID_API_KEY` |
| Key is revoked or suspended | 401 | `INVALID_API_KEY` |
| Key valid but scope missing | 403 | `INSUFFICIENT_SCOPE` |

---

## 5. Request Format

### Headers required on all requests

```http
Authorization: Bearer <api-key>
Content-Type: application/json
```

### Headers required for write requests (recommended)

```http
X-HAL-Idempotency-Key: <unique-key-per-request>
```

See [Idempotency](#7-idempotency) for details.

### Common body fields

Every write endpoint body must include these two fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Your app's identifier for the tenant/branch making the request. Must match an active installation. |
| `externalId` | string | ✓ | Your app's unique ID for this record. Used for deduplication. Max 255 chars. |

---

## 6. Response Format

### Success

All successful responses return HTTP `200` or `201` with this envelope:

```json
{
  "ok": true,
  "halId": "3f9a1d2c-...",
  "externalId": "the-id-you-sent",
  "sourceApp": "your-app-slug",
  "sourceTenantId": "restaurant-001",
  "warnings": []
}
```

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | Always `true` on success |
| `halId` | string (UUID) | The UUID of the record created or updated in HAL |
| `externalId` | string | Echo of the `externalId` you sent |
| `sourceApp` | string | Your app's slug as registered in HAL |
| `sourceTenantId` | string | Echo of the `externalTenantId` you sent |
| `warnings` | string[] | Non-fatal issues — the request succeeded, but read these |

### Warnings

Warnings are returned in the `warnings` array when the request succeeded but something notable happened. Examples:

- `"Customer with externalId 'cust-001' not found — invoice created without customer link"`
- `"Payment amount exceeds invoice outstanding balance. Only 500.00 SAR was allocated."`
- `"Invoice already exists — returning existing record"`

### Idempotency hit (duplicate request)

When a request is recognized as a duplicate via an idempotency key, the original response is replayed:

```json
{
  "ok": true,
  "duplicate": true,
  "message": "Request already processed"
}
```

Or, if the original response was cached in full, it is returned as-is with HTTP `200`.

### Error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of what went wrong",
    "details": {}
  }
}
```

---

## 7. Idempotency

Idempotency lets you safely retry requests without creating duplicate records.

### How to use it

Add the header to any write request:

```http
X-HAL-Idempotency-Key: <your-unique-key>
```

Alternative header name (also accepted):

```http
Idempotency-Key: <your-unique-key>
```

### Key requirements

- Must be unique **per request** — not per session or per day
- Recommended format: `<entity-type>-<your-id>-<attempt-number>` (e.g. `pay-3398-attempt-1`)
- Max length: 255 characters
- Scope: per app + per tenant + per endpoint — the same key on a different endpoint is a different key

### Behavior rules

| Scenario | What HAL does |
|---|---|
| First time this key is seen | Processes normally, caches the response |
| Key seen before, previous call succeeded (2xx or 4xx) | Returns the cached response immediately — **no second write** |
| Key seen before, previous call failed with 5xx | Retry is allowed — request is reprocessed |
| No key sent | Request processed normally, no dedup protection |

### Critical: always use idempotency for payments

Network failures during payment calls can leave your system unsure whether the payment was recorded. Always send a unique idempotency key with every `POST /payments` call.

```http
X-HAL-Idempotency-Key: pay-ORDER_ID-ATTEMPT_NUMBER
```

---

## 8. Rate Limiting

Requests are limited **per API key** using a sliding 60-second window.

- Default limit: **60 requests per minute**
- Your specific limit is set by the HAL admin when registering your app
- The `/ping` endpoint counts against your limit

### Rate limit exceeded response

**HTTP 429**

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 60 requests per minute for this integration."
  }
}
```

### Handling rate limits in your code

- Implement exponential backoff: wait 1s, then 2s, then 4s before retrying
- For high-volume use cases, batch multiple records into one call where possible, or contact the HAL admin to increase your limit (max: 1000 req/min)

---

## 9. Endpoints

---

### 9.1 Ping — Test API Key

Verify that your API key is valid and your app is active.

```
GET /ping
```

**No request body. No scope required.**

#### Response `200 OK`

```json
{
  "ok": true,
  "app": {
    "id": "uuid",
    "slug": "qrunful",
    "status": "active",
    "scopes": ["customers:upsert", "invoices:create", "payments:create"]
  },
  "message": "Integration authentication is valid"
}
```

#### curl example

```bash
curl https://<hal-domain>/api/v1/integrations/ping \
  -H "Authorization: Bearer hal_live_..."
```

---

### 9.2 Ping — Verify Tenant Mapping

Verify that a specific `externalTenantId` is mapped to a HAL company.

```
GET /ping/:externalTenantId
```

**No request body. No scope required.**

#### URL parameter

| Parameter | Description |
|---|---|
| `externalTenantId` | The tenant ID your app uses (URL-encoded if it contains special characters) |

#### Response `200 OK` — tenant is mapped

```json
{
  "ok": true,
  "app": {
    "id": "uuid",
    "slug": "qrunful",
    "status": "active",
    "scopes": ["customers:upsert"]
  },
  "tenant": {
    "externalTenantId": "restaurant-001",
    "externalTenantName": "مطعم البيت",
    "halCompanyId": "uuid-of-hal-company",
    "mapped": true
  },
  "message": "Tenant mapping verified"
}
```

#### Response `404` — tenant not mapped

```json
{
  "ok": false,
  "tenant": {
    "externalTenantId": "restaurant-001",
    "mapped": false
  },
  "message": "No active installation found for tenant \"restaurant-001\""
}
```

#### curl example

```bash
curl https://<hal-domain>/api/v1/integrations/ping/restaurant-001 \
  -H "Authorization: Bearer hal_live_..."
```

---

### 9.3 Upsert Customer

Create or update a customer. Safe to call repeatedly — deduplicates by `externalId`.

If the customer already exists (same `externalId`), their name, email, and phone are updated. No duplicate records are created.

On success, the customer appears in:
- **HAL CRM → Accounts** (with a CRM activity note)
- **HAL Finance → Customers** (linked to the CRM account, usable for invoicing)

```
POST /customers/upsert
Scope: customers:upsert
```

#### Request body

```json
{
  "externalTenantId": "restaurant-001",
  "externalId": "usr_9182",
  "name": "مطعم البيت",
  "mobile": "+966501234567",
  "email": "info@albait.com",
  "metadata": {
    "plan": "premium",
    "region": "riyadh",
    "joined_at": "2026-01-15"
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique customer ID — dedup key |
| `name` | string | ✓ | Display name. Min 1 char. |
| `mobile` | string | | Phone number in any format |
| `email` | string | | Must be a valid email if provided |
| `metadata` | object | | Any key-value pairs. Stored as JSONB. |

#### Response `200 OK`

```json
{
  "ok": true,
  "halId": "3f9a1d2c-0001-...",
  "externalId": "usr_9182",
  "sourceApp": "qrunful",
  "sourceTenantId": "restaurant-001",
  "warnings": []
}
```

`halId` is the HAL CRM Account UUID. Use it to reference this customer in support conversations or reporting.

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/customers/upsert \
  -H "Authorization: Bearer hal_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "restaurant-001",
    "externalId": "usr_9182",
    "name": "مطعم البيت",
    "mobile": "+966501234567",
    "email": "info@albait.com"
  }'
```

---

### 9.4 Create Lead

Push a sales prospect into the HAL CRM leads pipeline. Duplicate `externalId` is silently skipped — the existing lead's `halId` is returned.

On success, the lead appears in **HAL CRM → Leads** with status `new`, and a CRM activity note is logged against it.

```
POST /leads
Scope: leads:create
```

#### Request body

```json
{
  "externalTenantId": "samel-tenant-42",
  "externalId": "lead_5543",
  "name": "أحمد العمري",
  "mobile": "+966509876543",
  "email": "ahmed@example.com",
  "source": "samel_app",
  "metadata": {
    "signup_flow": "mobile",
    "campaign": "ramadan-2026"
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique lead ID — dedup key |
| `name` | string | ✓ | Lead's full name |
| `mobile` | string | | Phone number |
| `email` | string | | Email address |
| `source` | string | | Source tag (e.g. `samel_app`, `referral`). Defaults to your app slug. |
| `metadata` | object | | Arbitrary data stored as JSONB |

#### Response `201 Created`

```json
{
  "ok": true,
  "halId": "uuid-of-the-lead",
  "externalId": "lead_5543",
  "sourceApp": "samel",
  "sourceTenantId": "samel-tenant-42",
  "warnings": []
}
```

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/leads \
  -H "Authorization: Bearer hal_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "samel-tenant-42",
    "externalId": "lead_5543",
    "name": "أحمد العمري",
    "mobile": "+966509876543",
    "source": "samel_app"
  }'
```

---

### 9.5 Create Ticket

Open a support ticket in HAL. Calling with a duplicate `externalId` returns the existing ticket without creating a new one and without error.

On success, the ticket appears in **HAL Tickets** and a CRM activity note is logged.

```
POST /tickets
Scope: tickets:create
```

#### Request body

```json
{
  "externalTenantId": "bab-tenant-7",
  "externalId": "issue_334",
  "title": "فشل في عملية الدفع",
  "description": "لم يكتمل الدفع عند الخروج من التطبيق. رمز الخطأ: ERR_TIMEOUT",
  "priority": "high",
  "metadata": {
    "order_id": "ORD-9912",
    "app_version": "3.2.1",
    "platform": "ios"
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique issue ID — dedup key |
| `title` | string | ✓ | Ticket title. Min 1 char. |
| `description` | string | | Full description of the issue |
| `priority` | string | | `low` / `medium` / `high` / `critical`. Defaults to `medium`. |
| `metadata` | object | | Arbitrary data stored as JSONB |

#### Response `201 Created`

```json
{
  "ok": true,
  "halId": "uuid-of-the-ticket",
  "externalId": "issue_334",
  "sourceApp": "bab-sayer",
  "sourceTenantId": "bab-tenant-7",
  "warnings": []
}
```

#### Duplicate handling

If a ticket with that `externalId` already exists, the response includes:

```json
{
  "ok": true,
  "halId": "uuid-of-existing-ticket",
  "warnings": ["Ticket already exists — returning existing record"]
}
```

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/tickets \
  -H "Authorization: Bearer hal_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "bab-tenant-7",
    "externalId": "issue_334",
    "title": "فشل في عملية الدفع",
    "priority": "high"
  }'
```

---

### 9.6 Create Invoice

Create a draft invoice in HAL Finance. Fully idempotent by `externalId` — calling twice with the same ID returns the existing invoice.

Invoices are created with status `draft` and ZATCA status `not_ready`. They appear in HAL Finance immediately and can be reviewed, edited, and officially issued from there.

Amounts are in **SAR (Saudi Riyals), decimal format**.

```
POST /invoices
Scope: invoices:create
```

#### Request body

```json
{
  "externalTenantId": "qrunful-restaurant-001",
  "externalId": "inv_7721",
  "customerExternalId": "usr_9182",
  "amount": 1500.00,
  "currency": "SAR",
  "description": "اشتراك شهري — مايو 2026",
  "metadata": {
    "plan": "premium",
    "period": "2026-05",
    "order_ref": "ORD-44321"
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique invoice ID — dedup key |
| `amount` | number | ✓ | Amount in SAR, decimal (e.g. `1500.00`). Must be > 0. |
| `customerExternalId` | string | | Your customer's `externalId` (as used in `POST /customers/upsert`). If omitted or not found, invoice is created without a customer link. |
| `currency` | string | | Defaults to `SAR` |
| `description` | string | | Invoice line description |
| `metadata` | object | | Arbitrary data stored as JSONB |

#### Response `201 Created`

```json
{
  "ok": true,
  "halId": "uuid-of-the-invoice",
  "externalId": "inv_7721",
  "sourceApp": "qrunful",
  "sourceTenantId": "qrunful-restaurant-001",
  "warnings": []
}
```

`halId` is the HAL Finance document UUID. You can reference it when creating a payment.

#### Notes on ZATCA compliance

Integration invoices enter HAL as `draft / not_ready`. The HAL finance team reviews them and issues them through the standard workflow, which handles e-invoicing and ZATCA submission. Do not attempt to issue or finalize invoices via the integration API.

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/invoices \
  -H "Authorization: Bearer hal_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "qrunful-restaurant-001",
    "externalId": "inv_7721",
    "customerExternalId": "usr_9182",
    "amount": 1500.00,
    "description": "اشتراك شهري — مايو 2026"
  }'
```

---

### 9.7 Create Payment

Record an incoming payment in HAL Finance. Optionally allocates it against an existing invoice.

**Always send an idempotency key** to prevent double-recording on network retries.

```
POST /payments
Scope: payments:create
```

#### Request body

```json
{
  "externalTenantId": "qrunful-restaurant-001",
  "externalId": "pay_3398",
  "invoiceExternalId": "inv_7721",
  "amount": 1500.00,
  "currency": "SAR",
  "method": "online",
  "paidAt": "2026-05-10T14:30:00+03:00",
  "metadata": {
    "gateway": "tap",
    "transaction_id": "TAP-998877",
    "card_last4": "4242"
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique payment ID — dedup key |
| `amount` | number | ✓ | Amount in SAR, decimal. Must be > 0. |
| `invoiceExternalId` | string | | `externalId` of the invoice to allocate against. If not provided, payment is recorded as an unallocated receipt. If provided but not found, a warning is returned and payment is recorded without allocation. |
| `currency` | string | | Defaults to `SAR` |
| `method` | string | | `card` / `cash` / `bank` / `online` / `check`. Defaults to `online`. |
| `paidAt` | string (ISO 8601) | | When the payment occurred. Defaults to the time of the API call. |
| `metadata` | object | | Arbitrary data — store your gateway transaction ID here |

#### Response `201 Created`

```json
{
  "ok": true,
  "halId": "uuid-of-the-payment",
  "externalId": "pay_3398",
  "sourceApp": "qrunful",
  "sourceTenantId": "qrunful-restaurant-001",
  "warnings": []
}
```

#### Invoice allocation behavior

When `invoiceExternalId` is provided:

- If the invoice is found and has an outstanding balance, the payment is allocated up to the outstanding amount
- If `amount` > outstanding balance, only the outstanding amount is allocated — a warning is returned
- If the invoice is already fully paid, the payment is recorded but not allocated — a warning is returned
- The invoice status updates automatically: `partial` if partially paid, `paid` if fully paid

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/payments \
  -H "Authorization: Bearer hal_live_..." \
  -H "X-HAL-Idempotency-Key: pay-3398-attempt-1" \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "qrunful-restaurant-001",
    "externalId": "pay_3398",
    "invoiceExternalId": "inv_7721",
    "amount": 1500.00,
    "method": "online",
    "paidAt": "2026-05-10T14:30:00+03:00"
  }'
```

---

### 9.8 Post Activity / Event

Push a business event into HAL. Events with a registered handler trigger specific automated workflows. Unknown event types are logged as generic CRM activities with a warning.

```
POST /activity
Scope: activities:create
```

#### Request body

```json
{
  "externalTenantId": "qrunful-restaurant-001",
  "externalId": "evt_onboard_881",
  "eventType": "qrunful.restaurant.onboarded",
  "title": "مطعم جديد — مطعم البيت",
  "description": "تم تفعيل الحساب وإتمام الإعداد الأولي",
  "metadata": {
    "city": "الرياض",
    "cuisine": "saudi",
    "seats": 80
  }
}
```

#### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalTenantId` | string | ✓ | Must match an active installation |
| `externalId` | string | ✓ | Your unique event ID |
| `eventType` | string | ✓ | Namespaced event identifier (see registered types below) |
| `title` | string | ✓ | Human-readable event title |
| `description` | string | | Optional longer description |
| `metadata` | object | | Arbitrary event data |

#### Registered event types

| `eventType` | What HAL does |
|---|---|
| `qrunful.restaurant.onboarded` | Creates a HAL Project + 5 onboarding tasks for the account team |
| `samel.user.created` | Creates a CRM Lead with status `new` |
| *(any other value)* | Logged as a generic CRM Activity note. A `warnings` entry is added. |

To register a new event type, contact your HAL integration developer.

#### Response `200 OK`

```json
{
  "ok": true,
  "halId": "uuid-of-the-activity",
  "externalId": "evt_onboard_881",
  "sourceApp": "qrunful",
  "sourceTenantId": "qrunful-restaurant-001",
  "warnings": []
}
```

#### curl example

```bash
curl -X POST https://<hal-domain>/api/v1/integrations/activity \
  -H "Authorization: Bearer hal_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "externalTenantId": "qrunful-restaurant-001",
    "externalId": "evt_onboard_881",
    "eventType": "qrunful.restaurant.onboarded",
    "title": "مطعم البيت — تسجيل جديد"
  }'
```

---

## 10. Error Reference

### HTTP status codes

| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded (or idempotent duplicate returned) |
| `201 Created` | Record created successfully |
| `400 Bad Request` | Validation error — check your request body |
| `401 Unauthorized` | Missing, invalid, or revoked API key |
| `403 Forbidden` | API key valid but missing the required scope |
| `404 Not Found` | Tenant not mapped to any company |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |

### Error codes

| `error.code` | HTTP | Description | How to fix |
|---|---|---|---|
| `INVALID_API_KEY` | 401 | API key missing, malformed, revoked, or suspended | Check the key value; request a new key from HAL admin if revoked |
| `INSUFFICIENT_SCOPE` | 403 | The endpoint requires a scope not granted to your key | Ask HAL admin to add the scope to your app |
| `INSTALLATION_NOT_FOUND` | 404 | The `externalTenantId` in your body has no active installation | Ask HAL admin to create the installation; verify the tenant ID spelling |
| `VALIDATION_ERROR` | 400 | A required field is missing or has an invalid value | Check `error.details` for the specific field |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in the past 60 seconds | Wait and retry with exponential backoff |
| `NO_COMPANY_USER` | 500 | The HAL company has no users — cannot create records | HAL admin needs to set up the company properly |
| `SERVER_ERROR` | 500 | Unexpected internal error | Retry once after a few seconds; report to HAL team if persistent |

### Reading `error.details`

For `VALIDATION_ERROR`, the `details` field describes which field failed and why:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fieldErrors": {
        "externalId": ["Required"],
        "amount": ["Expected number, received string"]
      }
    }
  }
}
```

---

## 11. Scopes Reference

Scopes are granted per integration app by the HAL Super Admin. Your API key is rejected with `403 INSUFFICIENT_SCOPE` if you call an endpoint without the required scope.

| Scope | Required by | Description |
|---|---|---|
| `customers:upsert` | `POST /customers/upsert` | Create and update CRM accounts and finance customers |
| `leads:create` | `POST /leads` | Create CRM leads |
| `tickets:create` | `POST /tickets` | Open support tickets |
| `invoices:create` | `POST /invoices` | Create draft finance invoices |
| `payments:create` | `POST /payments` | Record payments and allocate against invoices |
| `activities:create` | `POST /activity` | Log business events and activities |

Ping endpoints (`GET /ping`, `GET /ping/:externalTenantId`) require **no scope** — just a valid API key.

---

## 12. How Tenant Mapping Works

Every write request goes through this resolution chain:

```
API key
  → Identify your app in integrated_apps
      → Read externalTenantId from request body
          → Look up integration_installations for (app + externalTenantId)
              → Get halCompanyId
                  → All writes go to that company
```

**Your app never specifies a HAL company ID directly.** The mapping is controlled by the HAL administrator. This means:

- The same `externalTenantId` always writes to the same HAL company
- You cannot cross-write to another company accidentally
- If a tenant is deactivated in HAL, requests for that tenant return `404` immediately without touching any data

### One key, many tenants

One API key can serve many tenants. Each tenant has its own installation:

| Your `externalTenantId` | HAL Company |
|---|---|
| `restaurant-riyadh-001` | شركة المطاعم السعودية |
| `restaurant-jeddah-002` | فروع جدة |
| `iot-device-floor-3` | مصنع الشمال |

You switch between tenants simply by changing `externalTenantId` in the request body.

---

## 13. Code Examples

### JavaScript / Node.js (fetch)

```javascript
const HAL_BASE = 'https://<hal-domain>/api/v1/integrations';
const HAL_KEY = process.env.HAL_API_KEY;

async function halRequest(method, path, body, idempotencyKey) {
  const headers = {
    'Authorization': `Bearer ${HAL_KEY}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) {
    headers['X-HAL-Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${HAL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`HAL error ${res.status}: ${data.error?.code} — ${data.error?.message}`);
  }
  return data;
}

// ── Examples ──────────────────────────────────────────────

// Upsert a customer
const customer = await halRequest('POST', '/customers/upsert', {
  externalTenantId: 'restaurant-001',
  externalId: `cust-${userId}`,
  name: user.displayName,
  mobile: user.phone,
  email: user.email,
});
console.log('HAL account ID:', customer.halId);

// Create an invoice
const invoice = await halRequest('POST', '/invoices', {
  externalTenantId: 'restaurant-001',
  externalId: `inv-${orderId}`,
  customerExternalId: `cust-${userId}`,
  amount: order.totalSAR,
  description: `Order #${orderId}`,
});

// Record payment (with idempotency key)
const payment = await halRequest(
  'POST',
  '/payments',
  {
    externalTenantId: 'restaurant-001',
    externalId: `pay-${paymentId}`,
    invoiceExternalId: `inv-${orderId}`,
    amount: payment.amountSAR,
    method: 'online',
    paidAt: new Date().toISOString(),
    metadata: { gateway: 'tap', transactionId: payment.tapId },
  },
  `pay-${paymentId}-attempt-1`  // idempotency key
);
```

### Python (requests)

```python
import os
import requests

HAL_BASE = 'https://<hal-domain>/api/v1/integrations'
HAL_KEY = os.environ['HAL_API_KEY']

def hal_request(method, path, body=None, idempotency_key=None):
    headers = {
        'Authorization': f'Bearer {HAL_KEY}',
        'Content-Type': 'application/json',
    }
    if idempotency_key:
        headers['X-HAL-Idempotency-Key'] = idempotency_key

    resp = requests.request(
        method,
        f'{HAL_BASE}{path}',
        headers=headers,
        json=body,
    )
    data = resp.json()
    if not data.get('ok'):
        raise Exception(f"HAL {resp.status_code}: {data['error']['code']} — {data['error']['message']}")
    return data


# Sync a customer
result = hal_request('POST', '/customers/upsert', {
    'externalTenantId': 'restaurant-001',
    'externalId': f'cust-{user_id}',
    'name': user['display_name'],
    'email': user['email'],
})
print('HAL account ID:', result['halId'])

# Open a ticket
result = hal_request('POST', '/tickets', {
    'externalTenantId': 'restaurant-001',
    'externalId': f'issue-{ticket_id}',
    'title': ticket['subject'],
    'description': ticket['body'],
    'priority': 'high',
})
```

### PHP (cURL)

```php
function halRequest(string $method, string $path, array $body = [], string $idempotencyKey = null): array {
    $baseUrl = 'https://<hal-domain>/api/v1/integrations';
    $apiKey  = getenv('HAL_API_KEY');

    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ];
    if ($idempotencyKey) {
        $headers[] = 'X-HAL-Idempotency-Key: ' . $idempotencyKey;
    }

    $ch = curl_init($baseUrl . $path);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!$response['ok']) {
        throw new Exception("HAL error: {$response['error']['code']} — {$response['error']['message']}");
    }
    return $response;
}

// Upsert a customer
$result = halRequest('POST', '/customers/upsert', [
    'externalTenantId' => 'restaurant-001',
    'externalId'       => 'cust-' . $userId,
    'name'             => $user['name'],
    'mobile'           => $user['phone'],
]);
```

---

## 14. Best Practices

### Always use idempotency keys for write requests

Especially for payments and invoices. Use a format like `<type>-<your-id>-<attempt>`:

```
pay-ORDER_9912-attempt-1
inv-ORDER_9912-attempt-1
```

Increment the attempt number on each retry after a 5xx failure.

### Upsert customers before creating invoices

The `POST /invoices` endpoint links to a customer via `customerExternalId`. If that customer hasn't been synced first, the invoice is created without a customer link (and a warning is returned). Always call `POST /customers/upsert` before `POST /invoices` for a new customer.

### Retry strategy for 5xx errors

```
Attempt 1 → fail → wait 1s
Attempt 2 → fail → wait 2s
Attempt 3 → fail → wait 4s
Attempt 4 → give up and alert
```

For payments, always include an idempotency key so retries are safe.

### Do not retry 4xx errors

`400`, `401`, `403`, and `404` errors indicate a problem with the request itself — retrying will produce the same error. Fix the request before retrying.

### Verify tenant mapping at app startup

Call `GET /ping/:externalTenantId` once when your app initializes for each tenant you serve. If any tenant returns `mapped: false`, alert immediately rather than accumulating failed write attempts.

### Store `halId` values

When a record is created in HAL, store the returned `halId` in your own database. This lets you reference the HAL record later (e.g. in support queries, reconciliation, or audit logs).

### Handle `warnings` gracefully

Warnings mean the request succeeded but something worth noting happened. Log them and monitor for recurring patterns — a persistent warning about a missing customer or unmatched invoice may indicate a sync order problem.

### Use structured `metadata`

Put useful identifiers in `metadata` so HAL users can cross-reference records:

```json
{
  "metadata": {
    "order_id": "ORD-9912",
    "gateway_transaction_id": "TAP-998877",
    "subscription_plan": "premium",
    "source_platform": "ios"
  }
}
```

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Integration App** | A registered external application in HAL. Has an API key, scopes, and a rate limit. |
| **API Key** | A secret token (`hal_live_...`) that authenticates your app. Shown once on creation; rotate if compromised. |
| **Installation** | A mapping between one of your `externalTenantId` values and a specific HAL company. One app can have many installations. |
| **externalTenantId** | Your app's identifier for a tenant/branch/client. Must be consistent across all API calls for that entity. |
| **externalId** | Your app's unique ID for a specific record (customer, invoice, etc.). Used for deduplication — sending the same `externalId` twice never creates a duplicate. |
| **halId** | The UUID assigned by HAL to the created or updated record. Returned in every success response. |
| **Scope** | A permission grant on an API key. Controls which endpoints the key can call. |
| **Idempotency Key** | A unique string you attach to a request so HAL can detect and ignore retries. |
| **Tenant Mapping** | The link between your `externalTenantId` and a HAL company UUID, configured by the HAL admin. |
| **Draft Invoice** | An invoice created via the integration API with status `draft` and ZATCA status `not_ready`. Must be reviewed and issued by the finance team inside HAL. |
| **Upsert** | Create-or-update — the operation inserts a new record if none exists, or updates the existing one if it does. |

---

*For questions or to request new scopes and event types, contact the HAL platform team.*
