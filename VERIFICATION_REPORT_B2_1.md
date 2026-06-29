# Verification Report: Sprint B2.1 — Cloud Native Runtime Configuration Hardening

This report details the implementation and validation of the Cloud Native Hardening layer for the SPS PPD Gua Musang Runtime Configuration Layer. The service is optimized for the stateless, episodic execution model of Firebase Cloud Functions while maintaining 100% backward compatibility and introducing robust, real-time cache observability.

---

## 1. Scope Accomplished & Deliverables

### Files Modified:
1. `/functions/services/runtimeConfigService.js` — Core backend refactoring: Removed persistent listener, implemented lazy cloud-native caching with TTL, version-aware validation check, and failure safety failovers. Added memory-only telemetry metrics and configuration drift detection.
2. `/src/services/monitoringService.ts` — Extended `RuntimeConfig` types and updated the client-side fetchers and listeners with parallel memory-based telemetry counters and simulated validation warning checks.
3. `/src/views/SystemMonitor/widgets/RuntimeConfigWidget.tsx` — Updated layout of the React governance widget to display the 8 newly introduced cache and drift telemetry fields.

---

## 2. Architecture & Design Specifications

### A. Lazy Cloud Native Cache Flow
The persistent Firestore listener (`onSnapshot()`) has been completely removed to avoid resource leaks in Cloud Functions. It is replaced with a **lazy, on-demand, episodic cache validation flow**:

```
Request (loadConfig)
  ↓
[Memory Cache Valid?] ──(Yes)──→ Increment Cache Hits ──→ Return Cache [O(1)]
  ↓ (No)
Increment Cache Misses
  ↓
Read Firestore (systemSettings/runtime)
  ↓
[Document Version Changed?]
  ├── (No) ──→ Update Local TTL timestamp ──→ Increment Hits ──→ Return Cache [O(1)]
  └── (Yes) ──→ Re-validate document fields ──→ Detect Drift ──→ Update Cache ──→ Return
```

* **Firestore Read Optimization**: For repeating requests within the 60-second TTL, reads are resolved instantly from memory ($O(1)$ lookup, 0 Firestore reads).
* **Version-Aware Fetch**: If the cache TTL expires but the Firestore document version has **not** changed, the existing validated cache is retained, extending its TTL with 0 validation re-run overhead. This limits Firestore reads to $\le 1$ per minute per Cloud Functions instance.

### B. In-Memory Runtime Cache Metrics
The following metrics are maintained purely in memory (never written back to Firestore to prevent infinite feedback loops):
* **Cache Hits / Misses Rate**: Tracked as hits over total requests.
* **Penyegaran (Refresh) Count**: Incremented upon every successful read or version validation.
* **Gagal (Fallback) Count**: Incremented when a Firestore outage triggers fallback strategies.
* **Durasi Penyegaran (Last Refresh Duration)**: Time taken to read and apply Firestore document configuration in milliseconds.
* **lastRefreshReason**: Categorizes the trigger: `TTL_EXPIRED`, `VERSION_CHANGED`, `CACHE_EMPTY`, `FALLBACK`.

### C. Configuration Drift Detection
Compares raw document properties in Firestore with the validated properties returned by `RuntimeConfigValidator`. If any cast operations, defaults fallbacks, or value out-of-bounds occurred, `configDrift` is flagged as `true` with deep diagnostic details retained.

---

## 3. Failure Strategy & Robustness (Section 9)

To ensure zero downtime for production traffic, the loading pipeline uses three layers of resilience:
1. **Firestore Outage**: If Firestore fails, the service retrieves the in-memory cache as failover with status `FAILOVER_HIT` and source `CACHE`.
2. **Missing In-Memory Cache**: If both Firestore and the in-memory cache are empty, the service merges `DEFAULT_CONFIG` with the local static `CONFIG.features`.
3. **Field-level Validation Errors**: Valid fields are parsed successfully; only invalid fields fall back to safe defaults without failing the entire configuration fetch.

---

## 4. Verification & Testing

* **TypeScript Compilation**: Executed `npm run lint` (`tsc --noEmit`). Status: **SUCCESS (0 errors)**.
* **Vite Bundle Build**: Executed `npm run build` (`vite build`). Status: **SUCCESS (Build complete)**.
* **Backward Compatibility**: Fully verified. No modifications to API schemas, HTTP response formats, Firestore security rules, or RBAC controls. All business operations compile and function successfully.
