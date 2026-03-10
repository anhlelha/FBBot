---
description: Pipeline for document, commit, push, and deploy on GCP VM after feature completion. Triggered via /ship.
---

# 🚀 /ship Pipeline

This workflow automates the final delivery cycle to production on Google Cloud Platform. 

// turbo-all
1. **Sync Documentation** (Optional/Auto): The Agent will identify all modified files and update `docs/architecture.md` or `docs/component-design.md` if needed.
2. **Commit & Push to GitHub**:
   - `git add . && git commit -m "chore: deployment update" && git push origin main`
3. **Deploy to GCP VM**:
   - `bash scripts/deploy-vm.sh`
4. **Verify Live Status**:
   - Run `ssh -o StrictHostKeyChecking=no anhlh48@34.9.136.241 "pm2 list"` to confirm the process is "online".
5. **Report to User**: Summarize the delivery results.
