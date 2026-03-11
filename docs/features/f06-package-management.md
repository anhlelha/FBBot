# f06-package-management.md

## Goal
Implement dynamic package management for the Platform Owner to create/edit subscription plans, and replace token estimation with precise `usageMetadata.totalTokenCount` from the Gemini API.

## Tasks
- [ ] Task 1: Update `src/database.js` to add `plans` schema and CRUD functions. Seed 'trial', 'basic', 'pro'.
- [ ] Task 2: Update `server.js` to add `GET /api/plans`, `POST /api/owner/plans`, `PUT /api/owner/plans/:id`, `DELETE /api/owner/plans/:id`.
- [ ] Task 3: Update `src/payment.js` to read from the DB dynamically instead of config constants.
- [ ] Task 4: UI Owner: Update `public/owner.html` and `public/dashboard.css` to add a "Plans" tab and management UI.
- [ ] Task 5: UI Dashboard: Update `public/dashboard.js` to fetch and render dynamic features.
- [ ] Task 6: Token Tracking: Update `src/ai.js` to return `tokensUsed` via `result.response.usageMetadata.totalTokenCount`.
- [ ] Task 7: Token Tracking: Update `src/tenantManager.js` and `server.js` to increment precisely.
- [ ] Task 8: Verification: Run `npm test`. Manual test creating a plan and hitting API limits.

## Done When
- [ ] Platform Owner can create, edit, delete subscription plans from UI.
- [ ] Tenant Dashboard shows the new real-time plans immediately.
- [ ] Tokens are incremented exactly based on actual LLM usage.
