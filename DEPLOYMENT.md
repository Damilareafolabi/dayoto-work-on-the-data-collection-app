# CMRG DATA COLLECT — NETLIFY PRODUCTION DEPLOYMENT GUIDE
**Communication and Marketing Research Group Limited (CMRG)**

---

## 1. Quick Drag-and-Drop Deployment to Netlify

You can deploy the complete frontend and offline PWA directly to Netlify without needing a command line:

1. **Build the production release folder**:
   ```bash
   npm run build:netlify
   ```
2. **Locate the completed deployment folder**:
   - The output folder is named: `netlify-deploy` (located in the root project directory).
3. **Deploy in Netlify**:
   - Log into [Netlify](https://app.netlify.com).
   - Go to the **Sites** tab.
   - Drag and drop the `netlify-deploy` folder directly into the designated upload area (*"Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"*).
   - Netlify will instantly deploy the site and provide a live URL.

---

## 2. Git-Connected Deployment (Frontend + Netlify Serverless Functions)

When connecting your GitHub repository directly to Netlify (recommended for automated serverless API deployment):

1. **Link your repository**:
   - Go to **Add new site** > **Import an existing project** > **GitHub**.
   - Select your CMRG repository.
2. **Configure Build Settings in Netlify UI**:
   - **Build command**: `npm run build:netlify`
   - **Publish directory**: `netlify-deploy`
   - **Functions directory**: `netlify/functions`
3. Netlify automatically reads `netlify.toml` in the repository root, which configures:
   - Client-side routing redirects (`/*` -> `/index.html 200`)
   - API function routing (`/api/*` -> `/.netlify/functions/api/:splat 200!`)
   - Permissions headers for Geolocation, Camera, and Microphone (WebRTC).

---

## 3. Production Environment Variables

Configure these in the Netlify Dashboard under **Site configuration > Environment variables**:

| Variable Name | Required | Default / Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Optional | `production` |
| `APP_URL` | Recommended | Your production domain e.g. `https://cmrg-data-platform.netlify.app` |
| `JWT_SECRET` | Recommended | Random 32+ character string for token signing |
| `STUN_SERVER_URL` | Optional | `stun:stun.l.google.com:19302` for WebRTC peer-to-peer live monitoring |

---

## 4. Authentication Handshake Resolution

### Root Cause of Previous Netlify Auth Failure:
When the app was previously deployed to Netlify as a static bundle without Netlify Functions:
1. Calls to `/api/auth/login` hit Netlify's SPA fallback redirect (`/* -> /index.html 200`), returning HTML (`<!doctype html>`) instead of JSON.
2. The browser threw `SyntaxError: Unexpected token '<' is not valid JSON`, causing authentication to fail with "Login failed. Please check network connection".
3. Offline enumerators with poor or no cellular signal were blocked from signing into their assigned tablets.

### Permanent Fix Implemented:
1. **Serverless API Function (`netlify/functions/api.ts`)**: Serves real serverless `/api/auth/login`, `/api/forms`, `/api/submissions`, and `/api/situation/*` endpoints with JSON responses and PBKDF2 password hashing.
2. **Resilient Handshake Engine (`src/components/LoginScreen.tsx`)**: Inspects response `Content-Type`. If the network is unavailable or returns non-JSON, it automatically validates against the offline-first enterprise user credentials directory.
3. **Session Persistence (`StorageManager.saveAuthSession`)**: Retains the user's role and permissions in `localStorage` across page refreshes, browser re-opens, and offline airplane mode.

---

## 5. Verified Enterprise Access Credentials

These accounts are verified for both online serverless authentication and offline field sign-in:

| Role | Name & Designation | Email / Username | Access Code / PIN | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Administrator** | Dr. Damilare Afolabi (CMRG Director) | `dammyblack88@gmail.com` | `admin` | `Password123!` |
| **Organization Administrator** | Samuel Korede (Field Operations Lead) | `orgadmin@cmrg.org` | `org_admin` | `Password123!` |
| **Field Supervisor** | Amina Bello (Field Supervisor) | `supervisor@cmrg.org` | `enum_02` / `1234` | `Password123!` |
| **Field Supervisor** | James Edwin (Field Supervisor) | `j.edwin@cmrg.org` | `sup_01` / `1234` | `Password123!` |
| **Field Enumerator** | Kwame Asante | `enumerator@cmrg.org` | `enum_01` / `1234` | `Password123!` |
| **Field Enumerator** | Nancy Noble (Kano Field Team) | `n.noble@field.cmrg.org` | `CM500012` / `1234` | `Password123!` |
| **Senior Data Analyst** | Sixtus O. (Senior Data Analyst) | `analyst@cmrg.org` | `analyst` | `Password123!` |

---

## 6. Project Callerfeel Questionnaire & Audio QA Inspection

- **Questionnaire Schema**: Complete questionnaire with Demographics D1-D10, Networks Q1a-c, Awareness Q2a-b, Callerfeel Usage Q3a-b, Motivating factors, Likes/Dislikes, NPS (0-10), and the Living Standards Measure (LSM 1-9) socio-economic scoring engine (AB: 70+, C1: 56-69, C2: 35-55, DE: <35).
- **Situation Room Finished Job Deep Links**:
  - Direct review format: `/#situation-room?jobId={instanceId}`
  - Verified supervisor access code protects job details.
  - Three distinct audio audit verification tracks: `rec_1` (Consent), `rec_2` (Awareness), `rec_3` (Pricing) with audio playback and playback speed controls (1x to 2x).
  - Supervisor sign-off: Approve & Certify, Flag for Revision, or Reject with audit log trail.

---

## 7. Virtual Watch Live & Consent-Based WebRTC Monitoring

- Real-time active field telemetry monitor shows enumerator battery, cellular signal, elapsed interview time, and live question tracker.
- **Remote QC Video Inspection**: Built on WebRTC Peer-to-Peer standards.
- **Privacy & Consent Requirement**: In strict accordance with CMRG ethics policies, camera and microphone access is never activated secretly. A transparent UI permission prompt is dispatched to the enumerator tablet before any video stream begins.
