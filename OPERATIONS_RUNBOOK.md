# SPS PPD Gua Musang — Production Operational Runbook

This runbook describes the standard operating procedures, deployment guidelines, disaster recovery workflows, and troubleshooting strategies for the Sektor Pengurusan Sekolah (SPS) PPD Gua Musang portal.

---

## 1. System Architecture Overview

```
                        [ Cloud Run Container (Port 3000) ]
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
          [ Google Firestore ]                [ Google Drive SDK ]
      (Metadata, Audit logs, KPIs)        (Laporan and Dokumen storage)
```

The system is designed as a secure, stateless, server-side-rendered or proxy-based full-stack application running on Google Cloud Run, communicating securely with Google Firestore and Google Drive (via OAuth service accounts).

---

## 2. Deployment Procedures (Step-by-Step)

To guarantee safe and repeatable production deployments, follow this sequence:

### Pre-Deployment Verification
1. **Activate Deployment Lock**: Set the `deploymentLock` status to `ACTIVE` in Firestore or the telemetry panel. This blocks administrative configurations and prevents concurrent changes.
2. **Review Security Rules**: Ensure `firestore.rules` are verified and tested under RBAC penetration guidelines.
3. **Audit Environment Variables**: Confirm that no dev keys or secrets are leaked inside the build profile.

### Deployment Commands
We compile the React front-end and bundle the custom server via `esbuild`:

```bash
# Clean previous builds
rm -rf dist

# Build and compile
npm run build
```

This generates `dist/` containing all compiled client assets and `dist/server.cjs` which runs on Node.

### Post-Deployment Smoke Test
1. **Launch Automated Smoke Test**: Execute the post-deployment script:
   ```bash
   npx tsx src/lib/smokeTest.ts
   ```
2. **Verify Indicators**: Ensure Auth, Firestore connectivity, Cloud Functions, and Google Drive return success states.
3. **Deactivate Deployment Lock**: Release the lock to resume administrative configuration.

---

## 3. Rollback Scenarios

If the post-deployment smoke test fails, or if a critical incident is reported post-release, execute the following emergency rollback procedures.

### Phase 1: Micro-Rollback (Feature Flags)
If the failure is isolated to a specific feature (e.g., Google Drive sync latency or Circuit Breaker alerts):
1. Navigate to the **System Monitor Dashboard** -> **Konfigurasi Runtime**.
2. Deactivate the specific flag (e.g., `enableCircuitBreaker` or `enableRequestTiming`) to bypass the faulty code path without restarting the container.

### Phase 2: Full Application Rollback
If there is a core application failure (e.g., routing crashes, container start loops):
1. Locate the previous stable build image tag in the Google Artifact Registry (e.g., `gcr.io/sps-ppd-gua-musang:v1.1.9-stable`).
2. Point Google Cloud Run back to the stable image:
   ```bash
   gcloud run deploy sps-ppd-gua-musang \
     --image gcr.io/sps-ppd-gua-musang:v1.1.9-stable \
     --region asia-southeast1
   ```
3. The deployment is completed within 15 seconds with zero downtime (traffic splitting instantly shifts 100% traffic to the old revision).

---

## 4. Database Backup & Restore Guide

### Automated Daily Backups
Production Firestore is configured for daily scheduled backups using Google Cloud Scheduler and Cloud Functions.
- **Schedule**: Every day at 02:00 UTC+8.
- **Storage Bucket**: `gs://sps-ppd-gua-musang-backup`
- **Retention**: 30 days retention policy.

### Manual On-Demand Backup
To trigger an on-demand backup before a major migration or database alteration:
```bash
gcloud firestore export gs://sps-ppd-gua-musang-backup/pre-deployment-v1.2.0
```

### Restore Procedure (Emergency Only)
To restore the database to a specific backup timestamp (WARNING: This will replace changed records):
1. Block all writes by setting the application runtime config to **Read-Only Mode** in the monitoring panel.
2. Execute the import command:
   ```bash
   gcloud firestore import gs://sps-ppd-gua-musang-backup/pre-deployment-v1.2.0
   ```
3. Verify integrity of the collections (`users`, `laporan`, `auditUploads`) and deactivate **Read-Only Mode**.

---

## 5. Disaster Recovery Steps (DRP)

In the event of a catastrophic regional cloud outage:

| Incident | Mitigation Strategy | Recovery Time Objective (RTO) |
| :--- | :--- | :--- |
| **Firestore Outage** | Failover to in-memory caching. The app stays readable in "Manual/Cached" mode using stale cache snapshots. | < 1 Minute (Automatic) |
| **Google Drive API Quota Exceeded** | Local buffer activation. Uploads are placed into a temporary Firestore storage queue until API quota resets. | < 5 Minutes (Manual toggle) |
| **Regional Cloud Run Failure** | Shift DNS routing to the cold-standby backup container in `asia-east1` (Taiwan). | < 10 Minutes (Failover DNS) |

---

## 6. Escalation Procedures

For critical, unresolved incidents:

1. **Level 1 (Operations Tech)**: Initial alert triage and log verification.
2. **Level 2 (Lead Developer)**: Infrastructure issues, API adjustments, and code hotfixes.
3. **Level 3 (DevSecOps / Security Architect)**: Data breaches, unauthorized access alarms, or persistent DDoS attacks.

---
*Last Updated: 28 June 2026 by DevSecOps Governance Team.*
