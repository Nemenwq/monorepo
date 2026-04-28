## Summary

This PR implements a comprehensive suite of landlord management features, replacing static mock data with live backend integration. It includes a new database schema for landlord profiles, authenticated API endpoints for tenant rosters and settings management, and fully interactive frontend dashboards for profile, notification, and payout configuration.

## Linked issue (recommended)

Closes #590, Closes #591, Closes #592, Closes #593

## Changes

### Backend Infrastructure
- **[New Migration]** `backend/migrations/010_landlord_profiles.sql`: Added tables for landlord settings, phone, company details, and bank information.
- **[AuthRepository]**: Added `LandlordProfile` interface and methods to `getLandlordProfile` and `updateLandlordProfile`.
- **[AuthStore]**: Exposed landlord profile management through `UserStore`.
- **[New Router]** `backend/src/routes/landlord.ts`: Implemented `GET /tenants`, `GET /settings`, and `PATCH /settings` endpoints.
- **[App Entry]** `backend/src/app.ts`: Registered the landlord router under `/api/landlord`.

### Frontend Dashboards
- **[Tenants Roster]** `frontend/app/dashboard/landlord/tenants/page.tsx`: Replaced mock data with live `apiFetch` integration; added NGN currency and date formatting.
- **[Settings Flow]** `frontend/app/dashboard/landlord/settings/page.tsx`: Implemented full state management for Profile, Notifications, and Payout tabs with real-time API syncing.

## Implementation Details

This is not a SOROBAN contract update. This PR focuses on full-stack features for landlord management.

## How to test

- [x] All automated tests pass
- [ ] Integration tests pass (if applicable)
- [x] Manual testing completed:
  - Verified tenant roster displays correct property and lease data from the database.
  - Verified profile, notification preferences, and bank details persist correctly across page reloads.
  - Verified role-based authentication prevents unauthorized access to landlord endpoints.

## Security Considerations

- [x] No secrets or sensitive data are logged
- [x] No changes to authentication/authorization logic without review (uses existing `authenticateToken` middleware)
- [x] No changes to admin/upgrade logic without review

## Screenshots (if UI)

Refer to the [walkthrough.md](file:///home/solodev/.gemini/antigravity/brain/5ed5eaf5-a724-4277-bbbb-bfafd6ccff2a/walkthrough.md) for detailed UI screenshots and state transitions (loading/success).

## Checklist

- [x] I linked an issue (or explained why one is not needed)
- [x] I tested locally
- [x] I did not commit secrets
- [x] I updated docs if needed
- [x] Code follows the project's style guidelines
- [x] CI checks pass
- [x] If UI changes: I included before/after screenshots (via walkthrough)
- [x] If images added/changed: I verified they are optimized and accessible
