# Database

PostgreSQL 16, managed with Prisma 6 (`backend/prisma/schema.prisma`, migrations in `backend/prisma/migrations`).
All primary keys are UUIDs; money uses `Decimal(12,2)`; timestamps are stored in UTC.

## Entity-relationship diagram

```mermaid
erDiagram
  User ||--o{ UserSession : has
  User ||--o{ PasswordResetToken : has
  User ||--o{ Client : "is lawyer of"
  User ||--o{ Case : leads
  User ||--o{ CaseAssignment : "assigned via"
  User ||--o{ Document : uploads
  User ||--o{ Invoice : creates
  User ||--o{ Notification : receives
  User ||--o{ ActivityLog : performs

  Client ||--o{ Case : has
  Client ||--o{ Document : has
  Client ||--o{ Contract : signs
  Client ||--o{ Invoice : "is billed"

  Case ||--o{ CaseAssignment : has
  Case ||--o{ Hearing : schedules
  Case ||--o{ Document : contains
  Case ||--o{ Contract : "linked to"
  Case ||--o{ Invoice : "billed for"

  Document ||--o{ Contract : "signed copy of"
  Invoice ||--|{ InvoiceItem : contains

  User {
    uuid id PK
    string email UK
    string passwordHash
    Role role
    boolean isActive
  }
  Client {
    uuid id PK
    string firstName
    string lastName
    string nationalId UK
    uuid lawyerId FK
    boolean isArchived
  }
  Case {
    uuid id PK
    string referenceNumber UK
    string title
    CaseType caseType
    CaseStatus status
    CasePriority priority
    uuid clientId FK
    uuid lawyerId FK
    datetime openingDate
    datetime closingDate
  }
  CaseAssignment {
    uuid caseId PK
    uuid userId PK
  }
  Hearing {
    uuid id PK
    uuid caseId FK
    datetime date
    string time
    HearingType type
    HearingStatus status
    boolean reminderSent
  }
  Document {
    uuid id PK
    uuid caseId FK
    uuid clientId FK
    string fileUrl "storage key"
    string mimeType
    int size
    uuid uploadedBy FK
  }
  Contract {
    uuid id PK
    uuid clientId FK
    uuid caseId FK
    uuid documentId FK
    date startDate
    date endDate
    ContractStatus status
    decimal value
  }
  Invoice {
    uuid id PK
    string invoiceNumber UK
    uuid clientId FK
    uuid caseId FK
    decimal amount
    decimal taxRate
    decimal tax
    decimal total
    decimal amountPaid
    InvoiceStatus status
    date dueDate
  }
  InvoiceItem {
    uuid id PK
    uuid invoiceId FK
    decimal quantity
    decimal unitPrice
    decimal total
    int position "line order"
  }
  Notification {
    uuid id PK
    uuid userId FK
    NotificationType type
    boolean isRead
    json data
    string dedupeKey UK
  }
  ActivityLog {
    uuid id PK
    uuid userId FK
    string action
    EntityType entity
    uuid entityId
    uuid caseId
    uuid clientId
    json metadata
  }
  SystemSettings {
    string id PK "always 'default'"
    string firmName
    string currency
    decimal defaultTaxRate
    int invoiceDueDays
    int contractExpiryWarningDays
    int invoiceDueWarningDays
  }
  UserSession {
    uuid id PK
    uuid userId FK
    string refreshTokenHash
    datetime expiresAt
    datetime revokedAt
  }
  PasswordResetToken {
    uuid id PK
    uuid userId FK
    string tokenHash UK
    datetime expiresAt
  }
```

## Key design decisions

| Topic               | Decision                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Case references     | Optional on create; otherwise generated as `CASE-YYYY-NNNN` (yearly sequence). Unique.                                                     |
| Invoice numbers     | Generated server-side as `INV-YYYY-NNNN`. Unique.                                                                                         |
| Invoice totals      | Always recomputed on the server from the items and tax rate (client values are ignored). Paid/partial status derived from `amountPaid`. |
| Client deletion     | `DELETE` **archives** the client (`isArchived`, restorable). Permanent deletion is admin-only and refused while cases or invoices exist. |
| Referential actions | `Restrict` for case → client/lawyer and invoice → client (no silent data loss); `Cascade` for hearings, assignments, invoice items.       |
| Files               | Only metadata in PostgreSQL. Binary content lives on disk (`UPLOAD_DIR`) or in an S3 bucket.                                              |
| Secrets             | Passwords hashed with bcrypt (cost 12); refresh and reset tokens stored as SHA-256 hashes only.                                          |
| Reminder idempotency| `Notification.dedupeKey` unique + `createMany({ skipDuplicates: true })`.                                                                 |
| Timeline            | `ActivityLog` rows are denormalised with `caseId`/`clientId` for fast case and client timelines.                                          |
| Indexes             | On foreign keys, status/date pairs used by dashboards and jobs (`Hearing(status,date)`, `Invoice(status,dueDate)`, `Contract(status,endDate)`), and search columns. |

## Commands

```bash
cd backend
npx prisma migrate dev        # create/apply a migration in development
npx prisma migrate deploy     # apply migrations in production (run by `npm run start:prod`)
npm run db:seed               # demo data (development only)
npm run db:reset              # drop, re-migrate and re-seed (development only)
npx prisma studio             # browse data
```
