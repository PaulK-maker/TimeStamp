# Backend Schema Technical Analysis

This document provides a detailed technical analysis of the database schema changes required to support Clerk authentication and Geofenced Time Tracking.

## 1. User/Caregiver Model Evolution (Clerk Integration)

To transition from custom JWT-based authentication to Clerk, the `Caregiver` (or `User`) model must be updated to synchronize with Clerk's user data.

### Proposed Schema Changes
- **Add `clerkId`**: `String`, `unique`, `required`, `index: true`. This is the primary key used to link a Clerk user to our local database.
- **Remove `password`**: Authentication is handled externally; storing hashes is no longer necessary.
- **Update `email`**: Ensure it remains unique and synced with Clerk's primary email.
- **Metadata**: Store Clerk-specific metadata if needed (e.g., `lastSignInAt`).

### Technical Considerations
- **Webhooks**: Use Clerk Webhooks (`user.created`, `user.updated`, `user.deleted`) to keep the local MongoDB in sync.
- **Role Management**: Roles (`admin` vs `caregiver`) can be stored in Clerk's `publicMetadata` and synced to the local `role` field for easier querying.

---

## 2. Facility Model (New)

To support geofencing, we need a way to define "Approved Locations".

### Proposed Schema
```javascript
const facilitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  radius: { type: Number, default: 200 }, // Allowed radius in meters
  isActive: { type: Boolean, default: true }
});
facilitySchema.index({ location: '2dsphere' });
```

### Technical Considerations
- **GeoJSON**: Using MongoDB's `2dsphere` index allows for efficient geospatial queries (e.g., `$near` or `$geoWithin`).
- **Radius**: A configurable radius per facility allows for flexibility (e.g., a large campus vs. a small residential home).

---

## 3. TimeEntry Model Enhancements (Geofencing)

The `TimeEntry` model must be expanded to store the "where" of every punch.

### Proposed Schema Updates
```javascript
const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  address: String,
  accuracy: Number, // GPS accuracy in meters
  isWithinFence: Boolean,
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }
});

// Update TimeEntry
{
  caregiver: { type: ObjectId, ref: 'Caregiver' },
  punchIn: {
    timestamp: Date,
    location: locationSchema
  },
  punchOut: {
    timestamp: Date,
    location: locationSchema
  },
  status: { type: String, enum: ['valid', 'flagged', 'manual_override'] }
}
```

### Technical Considerations
- **Validation Logic**: The backend should calculate the distance between the `punchIn.location` and the assigned `Facility.location` using the Haversine formula or MongoDB's `$geoNear`.
- **Audit Trail**: Storing the `accuracy` reported by the browser Geolocation API is crucial for resolving disputes (e.g., "I was there, but my GPS was off").
- **Flagging**: If a punch is allowed but outside the fence (e.g., for an admin), it should be marked as `flagged` for review.

---

## 4. Data Integrity & Security
- **Immutability**: Once a `punchIn` location is recorded, it should be immutable (except for admin notes).
- **Validation Middleware**: Create a reusable Express middleware that checks coordinates against the facility database before allowing a `POST /punches` request to proceed.

## 5. Future: HIPAA-Compliant Shift Notes

For the "Shift Notes/Handover" feature, storing Protected Health Information (PHI) requires strict adherence to HIPAA standards.

### Technical Requirements
- **Encryption at Rest**: Use AES-256 encryption for the `notes` field in MongoDB.
- **Encryption in Transit**: Ensure all API communication is over TLS 1.2+.
- **Field-Level Encryption**: Consider using Mongoose plugins or MongoDB's Client-Side Field Level Encryption (CSFLE) so that even database administrators cannot read the notes without the application's master key.
- **Audit Logging**: Maintain a strict log of who accessed which notes and when.
