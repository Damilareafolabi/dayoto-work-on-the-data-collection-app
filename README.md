# CMRG DataCollect — Standalone Field Survey Platform

A standalone, original progressive web application (PWA) and central situation room designed for the **Communication and Marketing Research Group (CMRG)**. Built with a clean red, black, and white design language, offline-first IndexedDB resilience, end-to-end envelope encryption, server-authoritative validation, and a PostgreSQL persistence engine.

---

## 1. Core Workflow Features

### Administrative Web Console
- **Questionnaire Designer & Catalog**: Create, preview, configure skip-logic constraints, and assign questionnaires. Supports text, long text, numbers, dates, yes/no, single choice, multiple choice, geopoints, signatures, photos, and repeatable roster groups.
- **Enumerator Directory & Access Control**: Register field officers, link device hardware tags, assign authorized questionnaires, and instantly deactivate compromised devices to deny incoming sync attempts.
- **Quality Audits & Situation Room**: Real-time geospatial tracking, speed violation alerts (surveys completed too quickly), duplicate submission flags, and consent-verified audio audits.
- **Data Export & SQL Studio**: Directly query field datasets with the in-browser SQL executor, export clean CSV datasets, or generate PostgreSQL DDL/DML dump scripts with idempotency clauses (`ON CONFLICT (instance_id) DO NOTHING`).

### Field Officer Mobile PWA
- **No App Store Requirement**: Installable directly from Safari (iOS) and Chrome (Android) by scanning the website QR code or navigating directly to the URL.
- **Full Offline Autonomy**: Questionnaires, drafts, finalized submissions, and media assets are stored locally in IndexedDB. Works 100% disconnected in remote areas.
- **CATI Phone Surveys**: Built-in dialpad simulator with speaker, mute, and hold toggles, caller relationship labeling, and mandatory audio recording consent notices.
- **Repeatable Household Roster Grids**: High-speed table entry for household rosters, asset lists, and repeated consumer audits.

---

## 2. Server & PostgreSQL Architecture

- **PostgreSQL Database Schema (`src/db/schema.sql`)**:
  - `cmrg_projects`: Research initiatives and client scopes.
  - `cmrg_enumerators`: Field surveyor registry with `active` status flags.
  - `cmrg_forms`: Questionnaire definitions and JSON schema specifications.
  - `cmrg_submissions`: Central submission storage with `instance_id` unique constraints, PostGIS coordinate points, duration metrics, and JSONB answers.
  - `cmrg_media_vault`: Private encrypted binary storage with role-based access control.
  - `cmrg_audit_trail`: Tamper-evident ledger of all administrative interventions.
- **Server-Side Validation Engine**: Validates field types, required fields, date formats (`YYYY-MM-DD`), and authorized options before writing to disk.
- **Duplicate Prevention / Idempotency**: Submissions sent with an identical `instance_id` are detected on receipt, confirming status without duplicate record generation.
- **Private Media Vault**: Photos and audio files are served exclusively through protected `/api/media/:mediaId` routes. No public upload buckets or exposed directory listings.

---

## 3. Environment Configuration (`.env`)

See `.env.example` for all options:
```env
PORT=3000
APP_URL="https://cmrg.research.org"
SQL_HOST="127.0.0.1"
SQL_PORT="5432"
SQL_USER="postgres"
SQL_PASSWORD="YOUR_DATABASE_PASSWORD"
SQL_DB_NAME="cmrg_datacollect"
DATABASE_URL="postgres://postgres:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/cmrg_datacollect"
```

---

## 4. Running Migrations & Tests

### Database Schema Migration
```bash
npm run migrate
```
Executes DDL statements in `src/db/schema.sql` against the configured PostgreSQL instance. If credentials are not yet supplied, gracefully falls back to memory persistence and logs setup guidance.

### Automated Test Suite
```bash
npm test
```
Runs the automated verification suite covering:
1. Server schema validation (required fields, number parsing, dates, choice bounds).
2. Network retry idempotency and duplicate elimination.
3. Access control blocking deactivated enumerator accounts.
4. Offline queue state transitions (`queued` -> `synced`).
5. SQL export formatting with SQL-injection and quote escaping.

---

## 5. Deployment Guide

### Option A: Google Cloud Run / Container
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Option B: VPS / Node Server
```bash
npm install
npm run build
npm run migrate
NODE_ENV=production npm start
```

---

## 6. Verification & Production Readiness Status Report

| Component | Test Status | Notes |
|---|---|---|
| PWA Manifest & Service Worker | **PASSED & VERIFIED** | Valid Web Manifest with 192/512px icons, standalone scope, and offline cache. |
| QR Code Installation | **PASSED & VERIFIED** | Dynamic QR code generated with `qrcode` pointing directly to runtime URL. |
| Server Schema Validation | **PASSED & VERIFIED** | Verified with 6 unit tests in `tests/survey.test.ts`. |
| Idempotency / Duplicate Retries | **PASSED & VERIFIED** | Tested against rapid network retries using identical `instanceId`. |
| Deactivated Enumerator Access | **PASSED & VERIFIED** | Tested with 403 Forbidden enforcement on deactivated accounts. |
| CSV / SQL Exports | **PASSED & VERIFIED** | Verified quote escaping and PostgreSQL DDL syntax. |
| Offline Storage (IndexedDB/Local) | **PASSED & VERIFIED** | Verified local persistence and storage quota estimator. |
| Shared PostgreSQL Pool | **READY FOR HOSTING** | Driver (`pg`) and DDL (`schema.sql`) tested. Requires host credentials in `.env`. |
| Private Media Storage | **READY FOR HOSTING** | Private vault routes tested. Ready for local disk or private S3/GCS bucket attachment. |
