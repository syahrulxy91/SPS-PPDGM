# SPS PPD Gua Musang — Production Deployment Checklist

This checklist defines the rigorous validation gates and verification tasks required to execute a secure and successful production release of the SPS PPD Gua Musang digital governance platform.

---

## 1. Pre-Deployment Gate (Go / No-Go Decision)

Verify that all development deliverables have been completed, reviewed, and signed off under enterprise security compliance.

*   [ ] **Linting & Code Quality**: No warnings or errors remain under TypeScript strict compilation checks.
    *   *Verification*: `npm run lint` yields exit code 0.
*   [ ] **Release Manifest Compilation**: Review `/RELEASE_MANIFEST.md` for accurate target versions, build numbers, and integrity hashes.
*   [ ] **Security Audit Validation**: Ensure Firestore security rules have been thoroughly verified against the RBAC Penetration Testing Suite (`SECURITY_REPORT_C2.md`).
*   [ ] **Vulnerability Sweep**: Confirm no temporary testing credentials, debug logs, or development endpoints exist in active production source code branches.

---

## 2. Active Deployment Operations

Follow this sequence exactly to ensure minimum system drift or transaction collision:

### Step 1: Secure Configuration Locks
*   [ ] **Activate Deployment Lock**: Set the system deployment lock state to `ACTIVE` in the monitoring database. This blocks other administrators from modifying the runtime settings, protecting the active environment.
*   [ ] **Set Maintenance Banner**: Trigger a temporary, soft maintenance notice to alert normal users of active deployment windows.

### Step 2: Database and Rule Deployment
*   [ ] **Backup Database**: Trigger a manual snapshot of the current Firestore database state:
    ```bash
    gcloud firestore export gs://sps-ppd-gua-musang-backup/pre-release-v1.2.0
    ```
*   [ ] **Deploy Hardened Rules**: Publish the audited security controls to Firestore:
    ```bash
    firebase deploy --only firestore:rules
    ```

### Step 3: Container Compilation and Routing
*   [ ] **Compile & Pack Applet**: Trigger the production Node.js and static package bundle generation:
    ```bash
    npm run build
    ```
*   [ ] **Deploy Cloud Run Revision**: Upload the compiled bundle and configure resource allocations (1024MB RAM, CPU scaling, min-instances count).
*   [ ] **Configure Environment Secrets**: Verify environment bindings on Cloud Run (e.g., `GEMINI_API_KEY`).

---

## 3. Post-Deployment Verification (Smoke Tests)

Once the new container revision is live, perform immediate validation:

*   [ ] **Run Post-Deployment Smoke Tests**: Trigger the automated smoke-test suite (`tsx src/lib/smokeTest.ts`) to verify:
    *   [ ] Firebase Authentication APIs
    *   [ ] Firestore real-time collection read/writes
    *   [ ] Cloud Functions REST endpoints
    *   [ ] Google Drive API connectivity
*   [ ] **Confirm Version Visibility**: Open the **SPS Telemetry Dashboard** and confirm that the version reads `v1.2.0-prod` with `Build #20260628.1`.
*   [ ] **Check Health Score**: Verify that the monitoring engine computes a perfect health score (>95) and no configuration drift is reported.

---

## 4. Promotion & Handover

*   [ ] **Deactivate Deployment Lock**: Set the system deployment lock state to `INACTIVE` to allow general operations.
*   [ ] **Remove Maintenance Banner**: Restore normal user access to the platform.
*   [ ] **Generate Release Documentation**: Commit `/RELEASE_MANIFEST.md` and `/SMOKE_TEST_REPORT.md` to the configuration archiving repository.

---
*Last Updated: 28 June 2026 by Release Engineering Committee.*
