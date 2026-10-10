# REST API

Base URL: `http://localhost:5000` in development, your Render URL in production. All business endpoints live under
`/api` and exchange JSON (except document upload/download).

## Conventions

**Authentication.** Send `Authorization: Bearer <accessToken>` (from login/refresh). The refresh token travels only in
the `httpOnly` cookie set by the API on `/api/auth`, so browser calls must use `credentials: 'include'`.

**Success**

```json
{ "success": true, "data": { "id": "…" } }
```

**Paginated lists**

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "pageSize": 10, "total": 42, "totalPages": 5 }
}
```

**Errors**

```json
{ "success": false, "message": "Validation failed", "errorCode": "VALIDATION_ERROR", "details": [{ "path": "email", "message": "Invalid email" }] }
```

| Status | Typical `errorCode`                                                                       |
| ------ | ----------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`, `INVALID_JSON`, `CASE_CLOSED`, `INVOICE_LOCKED`, `INVALID_DUE_DATE`, `SELF_LOCKOUT`, `UPLOAD_ERROR` |
| 401    | `UNAUTHORIZED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_REUSED`, `SESSION_REVOKED`, `ACCOUNT_INACTIVE` |
| 403    | `FORBIDDEN`, `CASE_FORBIDDEN`, `CLIENT_FORBIDDEN`, `REGISTRATION_DISABLED`                |
| 404    | `NOT_FOUND`, `CASE_NOT_FOUND`, `CLIENT_NOT_FOUND`, `ROUTE_NOT_FOUND`                      |
| 409    | `DUPLICATE_RESOURCE`, `CLIENT_HAS_RELATED_RECORDS`, `RELATED_RECORDS_CONFLICT`            |
| 413    | `FILE_TOO_LARGE`                                                                          |
| 429    | `RATE_LIMITED`                                                                            |

The frontend maps every `errorCode` to a translated message (`messages/*.json` → `errors`).

**List query parameters** (all list endpoints): `page` (default 1), `pageSize` (default 10, max 100), `search`,
`sortBy` (whitelisted per resource), `sortOrder` (`asc` | `desc`). Multi-value filters accept `?status=A,B` or
`?status=A&status=B`. Dates accept ISO strings (`YYYY-MM-DD` or full instants).

**Rate limits** (per IP, 15 min): 1000 requests on `/api`, 30 on login/register/password endpoints, 300 on refresh.

**Roles.** `A` = ADMIN, `L` = LAWYER, `S` = ASSISTANT. Beyond the role column, every read and write is filtered by
row-level scope (see [architecture.md](architecture.md#authorization)): a resource outside the user's scope returns 403/404.

## Health

| Method | Path            | Description                                               |
| ------ | --------------- | --------------------------------------------------------- |
| GET    | `/health`       | Liveness: `{"status":"ok"}`                               |
| GET    | `/health/ready` | Readiness: also checks the database (503 when unreachable) |

## Auth — `/api/auth`

| Method | Path               | Roles | Body / notes                                                                    |
| ------ | ------------------ | ----- | ------------------------------------------------------------------------------- |
| POST   | `/register`        | —     | `firstName, lastName, email, password, phone?` (only if `ALLOW_REGISTRATION`)   |
| POST   | `/login`           | —     | `email, password` → `{ accessToken, user }` + refresh cookie                    |
| POST   | `/refresh`         | —     | Uses the cookie; rotates it → `{ accessToken, user }`                           |
| POST   | `/logout`          | —     | Revokes the session and clears the cookie                                       |
| POST   | `/forgot-password` | —     | `email`; always 200 (no account enumeration); sends a 1-hour reset link        |
| POST   | `/reset-password`  | —     | `token, password`; revokes every session                                        |
| GET    | `/me`              | A L S | Current user                                                                    |
| PUT    | `/profile`         | A L S | `firstName, lastName, phone?, avatar?`                                          |
| PUT    | `/password`        | A L S | `currentPassword, newPassword`; revokes the other sessions                      |

Passwords: 8–128 characters with at least one letter and one digit. `passwordHash` is never returned.

## Users — `/api/users`

| Method | Path      | Roles | Notes                                                                            |
| ------ | --------- | ----- | -------------------------------------------------------------------------------- |
| GET    | `/lookup` | A L   | `?role=LAWYER,ASSISTANT` — active users for pickers (id, name, role)            |
| GET    | `/`       | A     | Filters `role`, `isActive`; sort `createdAt, lastName, email, role`              |
| POST   | `/`       | A     | `firstName, lastName, email, password, role, phone?`                             |
| GET    | `/:id`    | A     |                                                                                  |
| PUT    | `/:id`    | A     | `firstName?, lastName?, email?, phone?, role?, isActive?, password?`; deactivating or resetting the password revokes sessions; an admin cannot demote/deactivate themself (`SELF_LOCKOUT`) |

## Clients — `/api/clients`

| Method | Path            | Roles | Notes                                                                                      |
| ------ | --------------- | ----- | ------------------------------------------------------------------------------------------ |
| GET    | `/`             | A L S | Filters `lawyerId`, `archived=true|false|all`; sort `createdAt, lastName, firstName, email` |
| POST   | `/`             | A L   | `firstName, lastName, email?, phone?, address?, nationalId?, notes?, lawyerId?` (admin)    |
| GET    | `/:id`          | A L S | Includes counts, unpaid balance                                                            |
| GET    | `/:id/timeline` | A L S | Activity log for the client                                                                |
| PUT    | `/:id`          | A L   |                                                                                            |
| DELETE | `/:id`          | A L   | Archives. `?permanent=true` (admin) deletes when no cases/invoices exist                   |
| POST   | `/:id/restore`  | A L   | Un-archives                                                                                |

## Cases — `/api/cases`

| Method | Path            | Roles | Notes                                                                                                                           |
| ------ | --------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`             | A L S | Filters `status, priority, caseType, clientId, lawyerId, court, from, to`; sort `createdAt, openingDate, referenceNumber, priority, status, title, updatedAt` |
| POST   | `/`             | A L   | `title, clientId, caseType, status?, priority?, referenceNumber?, court?, judge?, opposingParty?, description?, openingDate?, lawyerId? (admin), assistantIds?` |
| GET    | `/:id`          | A L S | Includes client, lawyer, assistants, counts, next hearing                                                                       |
| GET    | `/:id/timeline` | A L S |                                                                                                                                 |
| PUT    | `/:id`          | A L   | Lead lawyer or admin                                                                                                            |
| POST   | `/:id/close`    | A L   | Sets `CLOSED` + `closingDate`                                                                                                   |
| POST   | `/:id/reopen`   | A L   |                                                                                                                                 |
| DELETE | `/:id`          | A L   | Lead lawyer or admin. Deletes hearings, documents (and stored files); invoices and contracts are kept and unlinked             |

## Hearings — `/api/hearings`

| Method | Path            | Roles | Notes                                                                                                       |
| ------ | --------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/`             | A L S | Filters `caseId, clientId, status, court, from, to, range=today|tomorrow|week|upcoming|overdue`; sort `date, createdAt` |
| POST   | `/`             | A L S | `caseId, date (ISO instant), time (HH:mm), type?, status?, court?, location?, notes?` — the case must be open |
| GET    | `/:id`          | A L S |                                                                                                             |
| PUT    | `/:id`          | A L S | Rescheduling restarts the reminder cycle                                                                    |
| POST   | `/:id/complete` | A L S | `notes?`                                                                                                    |
| DELETE | `/:id`          | A L S |                                                                                                             |

Creating or rescheduling a hearing within 7 days immediately triggers the matching reminder.

## Documents — `/api/documents`

| Method | Path            | Roles | Notes                                                                                                       |
| ------ | --------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/`             | A L S | Filters `type, caseId, clientId`; sort `createdAt, name, size`                                              |
| POST   | `/`             | A L S | `multipart/form-data`: `file`, `name?`, `type?`, `caseId?` and/or `clientId?` (one required). PDF, Word, Excel, images, text; max `MAX_UPLOAD_MB` |
| GET    | `/:id`          | A L S | Metadata                                                                                                    |
| GET    | `/:id/download` | A L S | Streams the file (`?inline=true` for previewable types)                                                     |
| PATCH  | `/:id`          | A L S | `name?, type?`                                                                                              |
| DELETE | `/:id`          | A L S | Managers or the uploader                                                                                    |

## Contracts — `/api/contracts` (A L)

| Method | Path   | Notes                                                                                                         |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/`    | Filters `status, clientId, caseId, view=active|expired|expiring`; sort `createdAt, startDate, endDate, title` |
| POST   | `/`    | `clientId, title, startDate, endDate?, status?, value?, caseId?, documentId?, description?`                    |
| GET    | `/:id` |                                                                                                               |
| PUT    | `/:id` |                                                                                                               |
| DELETE | `/:id` |                                                                                                               |

## Invoices — `/api/invoices` (A L)

| Method | Path          | Notes                                                                                                         |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/`           | Filters `status, clientId, caseId, from, to`; sort `createdAt, issueDate, dueDate, total, invoiceNumber`. `meta` also carries totals (cancelled invoices excluded) |
| POST   | `/`           | `clientId, items[{description, quantity, unitPrice}], taxRate?, issueDate?, dueDate?, caseId?, notes?, status=DRAFT|SENT` — totals computed server-side |
| GET    | `/:id`        | Includes items, client, case                                                                                  |
| PUT    | `/:id`        | Paid or cancelled invoices are locked                                                                         |
| POST   | `/:id/pay`    | `amount?` (defaults to the balance; overpayment refused), `paidAt?` → `PARTIALLY_PAID` or `PAID`             |
| POST   | `/:id/cancel` |                                                                                                               |
| DELETE | `/:id`        | Drafts only                                                                                                   |

## Notifications — `/api/notifications`

| Method | Path            | Notes                                         |
| ------ | --------------- | --------------------------------------------- |
| GET    | `/`             | `unreadOnly`, `type`; default `pageSize` 20   |
| GET    | `/unread-count` | `{ count }`                                   |
| PATCH  | `/read-all`     |                                               |
| PATCH  | `/:id/read`     |                                               |
| DELETE | `/:id`          |                                               |

Users only ever see their own notifications.

## Dashboard, reports, settings, jobs

| Method | Path                       | Roles | Notes                                                                                  |
| ------ | -------------------------- | ----- | -------------------------------------------------------------------------------------- |
| GET    | `/api/dashboard/stats`     | A L S | Scoped totals, hearings today/tomorrow/upcoming/overdue, charts, activity; finance for A L |
| GET    | `/api/reports`             | A L   | `from, to, lawyerId?` — cases, hearings and revenue aggregates                          |
| GET    | `/api/settings`            | A L S | Firm settings (name, currency, tax rate, due days, warning windows)                    |
| PUT    | `/api/settings`            | A     |                                                                                        |
| POST   | `/api/admin/jobs/reminders`| A     | Runs the reminder job now; returns counts                                              |

## Example

```bash
TOKEN=$(curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"lawyer@example.com","password":"<password>"}' \
  http://localhost:5000/api/auth/login | jq -r .data.accessToken)

curl -s -H "Authorization: Bearer $TOKEN" 'http://localhost:5000/api/hearings?range=week&pageSize=20'
```
