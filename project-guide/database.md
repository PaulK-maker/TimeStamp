# Database Schema

The project uses MongoDB with Mongoose for data modeling.

## Models

### Caregiver (`Caregiver`)

Represents a user in the system (either a caregiver or an admin).

| Field | Type | Description |
| :--- | :--- | :--- |
| `firstName` | String | User's first name. |
| `lastName` | String | User's last name. |
| `email` | String | Unique email address (used for login). |
| `password` | String | Hashed password (hidden by default). |
| `role` | String | Either `caregiver` or `admin`. |
| `isActive` | Boolean | Whether the account is active. |

### TimeEntry (`TimeEntry`)

Represents a single work shift or "punch".

| Field | Type | Description |
| :--- | :--- | :--- |
| `caregiver` | ObjectId | Reference to the `Caregiver` model. |
| `punchIn` | Date | The time the caregiver clocked in. |
| `punchOut` | Date | The time the caregiver clocked out (null if still working). |
| `notes` | String | Optional notes about the shift. |

### MissedPunchRequest (`MissedPunchRequest`)

Represents a caregiver-submitted request to correct a missing punch (e.g., missing punch-out). This does not edit the original `TimeEntry`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `caregiver` | ObjectId | Reference to the `Caregiver` model. |
| `timeEntry` | ObjectId | Reference to the `TimeEntry` model. |
| `missingField` | String | Which punch is missing (`punchOut` currently supported). |
| `requestedTime` | Date | The caregiver-requested timestamp. |
| `reason` | String | Optional explanation. |
| `status` | String | `pending`, `approved`, `rejected`, `cancelled`. |
| `reviewedBy` | ObjectId | Admin reviewer (Caregiver ref). |
| `reviewedAt` | Date | Review timestamp. |
| `adminNote` | String | Optional admin note. |

### TimeEntryCorrection (`TimeEntryCorrection`)

Represents an approved overlay for a `TimeEntry` (effective punch times). This keeps `TimeEntry.punchIn/punchOut` immutable.

| Field | Type | Description |
| :--- | :--- | :--- |
| `timeEntry` | ObjectId | Reference to the `TimeEntry` model (unique). |
| `caregiver` | ObjectId | Reference to the `Caregiver` model. |
| `effectivePunchIn` | Date | Optional corrected punch-in time. |
| `effectivePunchOut` | Date | Optional corrected punch-out time. |
| `sourceRequest` | ObjectId | Link back to the originating request. |
| `approvedBy` | ObjectId | Admin who approved the overlay. |

## Relationships

- A `Caregiver` can have many `TimeEntry` records.
- Each `TimeEntry` belongs to exactly one `Caregiver`.

## Effective punch fields

Some API responses include `effectivePunchIn` and `effectivePunchOut` alongside the raw `punchIn` and `punchOut`. If an approved correction exists, the effective fields are used for reporting while raw punches remain unchanged.

## Future payroll schema boundary

Payroll is planned as a provider-backed integration. The local database should support payroll preparation and auditability without turning TimeStamp into a payroll engine.

### Allowed local payroll data

When payroll work begins, local models may store operational payroll metadata such as:

- approved hours for a payroll period
- compensation type (`hourly`, `salary`, `contractor`)
- pay-rate or salary references needed for preview workflows
- payroll eligibility flags
- worker classification metadata
- provider linkage IDs
- payroll run references, statuses, and audit history

Any locally derived payroll totals should be treated as preview-only and never as the source of truth for employee pay.

### Forbidden local payroll data and logic

Do not store or implement the following in-house unless a provider integration explicitly requires a secure delegated pattern:

- SSNs
- tax election data
- bank account numbers
- routing numbers
- custom tax logic
- withholding logic
- payroll disbursement workflows
- filing workflows
- authoritative net-pay calculations

### Recommended future models

If payroll support is added later, prefer a small set of tenant-scoped models and fields:

- `Staff.payrollProfile` for non-regulated operational metadata only
- `PayrollRun` for one payroll execution attempt for a pay period
- `PayrollRunItem` for per-worker input snapshots used in a payroll run
- `PayrollWebhookEvent` for deduplicated provider webhook audit history

These records should stay tenant-scoped, access-controlled, and limited to operational metadata, audit history, and provider references.

### Provider source of truth

A payroll provider such as Gusto should remain responsible for:

- payroll calculation
- deductions and withholding
- payment execution
- filings
- compliance updates
- regulated payroll data collection and management

Provider webhooks should be treated as the source of truth for payroll run state once payroll integration begins.
