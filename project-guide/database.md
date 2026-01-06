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

## Relationships

- A `Caregiver` can have many `TimeEntry` records.
- Each `TimeEntry` belongs to exactly one `Caregiver`.
