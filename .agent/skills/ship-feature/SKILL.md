---
name: ship-feature
description: Automates the final delivery phase of a feature: documentation update, source control push, and deployment to GCP VM.
skills: ["clean-code", "deployment-procedures"]
---

# 🚢 Ship Feature Skill

This skill governs the "Last Mile" of development. It ensures the feature transition from local development to production on Google Cloud Platform while maintaining documentation integrity.

## 📋 PRE-FLIGHT CHECKLIST

Before triggering the delivery, the Agent must:
1. **Audit Files**: Identify all modified files that aren't yet committed.
2. **Review Documentation**: Determine if UI/Logic changes invalidate the current `docs/architecture.md` or `docs/component-design.md`.
3. **Validate Build**: Ensure `npm run dev` (or equivalent) starts without errors.

## 🚀 DELIVERY PIPELINE

The delivery must follow this exact sequence:

### Phase 1: Documentation (Sync)
- Update `docs/architecture.md` if data models or flow diagrams changed.
- Update `docs/component-design.md` if API endpoints or modules were added/modified.

### Phase 2: Git Push (Origin)
- Use standard commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`.
- Push to GitHub `main` branch.
- **Reference Script**: `./scripts/deploy-git.sh "message"` or manual `git push`.

### Phase 3: GCP Deployment (Production)
- **Mandatory Step**: Execute `./scripts/deploy-vm.sh`.
- **Target**: VM `34.9.136.241`.
- **Verify**: Audit the PM2 process status after deployment using `ssh anhlh48@34.9.136.241 "pm2 list"`.

## ⚠️ ERROR HANDLING

- If **Git push fails**: Resolve conflicts or authentication issues before proceeding to GCP.
- If **GCP deployment fails**: Check SSH connectivity and `.env` configuration on the VM.
