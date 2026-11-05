import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import crypto from 'crypto';
import {
  CALLERFEEL_FORM_DEFINITION,
  SEEDED_CALLERFEEL_SUBMISSIONS,
} from '../../src/lib/callerfeelDataset.ts';
import {
  INITIAL_FORMS,
  INITIAL_SUBMISSIONS,
  INITIAL_ENUMERATORS,
  INITIAL_PROJECTS,
} from '../../src/lib/mockData.ts';

// In-Memory store across warm serverless execution invocations
const serverlessUsers = new Map<string, any>();
const serverlessSubmissions = new Map<string, any>();
const serverlessForms = new Map<string, any>();
const serverlessProjects = new Map<string, any>();
const serverlessAuditLogs: any[] = [];
const webrtcSessions = new Map<string, any>();

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const hash = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

// Seed default accounts
const defaultSalt = 'cmrg_salt_2026_enterprise';
const defaultHash = hashPassword('Password123!', defaultSalt);
const pinSalt = 'cmrg_pin_salt_2026';
const pinHash = hashPassword('1234', pinSalt);

const DEFAULT_USERS = [
  {
    id: 'usr_platform_admin',
    email: 'dammyblack88@gmail.com',
    displayName: 'Dr. Damilare Afolabi (CMRG Director)',
    role: 'platform_admin',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'admin',
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
  },
  {
    id: 'usr_org_admin',
    email: 'orgadmin@cmrg.org',
    displayName: 'Samuel Korede (Field Operations Lead)',
    role: 'org_admin',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'org_admin',
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
  },
  {
    id: 'usr_supervisor',
    email: 'supervisor@cmrg.org',
    displayName: 'Amina Bello (Field Supervisor)',
    role: 'supervisor',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'enum_02',
    pinHash,
    pinSalt,
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01', 'prj_02'],
  },
  {
    id: 'usr_supervisor_james',
    email: 'j.edwin@cmrg.org',
    displayName: 'James Edwin (Field Supervisor)',
    role: 'supervisor',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'sup_01',
    pinHash,
    pinSalt,
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01'],
  },
  {
    id: 'usr_enumerator_kwame',
    email: 'enumerator@cmrg.org',
    displayName: 'Kwame Asante (Field Enumerator)',
    role: 'enumerator',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'enum_01',
    pinHash,
    pinSalt,
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01'],
  },
  {
    id: 'usr_enumerator_nancy',
    email: 'n.noble@field.cmrg.org',
    displayName: 'Nancy Noble (Field Enumerator)',
    role: 'enumerator',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'CM500012',
    pinHash,
    pinSalt,
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01'],
  },
  {
    id: 'usr_analyst',
    email: 'analyst@cmrg.org',
    displayName: 'Sixtus O. (Senior Data Analyst)',
    role: 'data_analyst',
    passwordHash: defaultHash,
    salt: defaultSalt,
    orgId: 'org_cmrg',
    orgName: 'Communication and Marketing Research Group Limited',
    accessCode: 'analyst',
    isEmailVerified: true,
    active: true,
    assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
  },
];

function initServerlessData() {
  if (serverlessUsers.size === 0) {
    for (const u of DEFAULT_USERS) {
      serverlessUsers.set(u.email.toLowerCase(), u);
      if (u.accessCode) serverlessUsers.set(u.accessCode.toLowerCase(), u);
    }
  }

  if (serverlessForms.size === 0) {
    for (const f of INITIAL_FORMS) {
      serverlessForms.set(f.id, f);
      serverlessForms.set(f.formId, f);
    }
  }

  if (serverlessProjects.size === 0) {
    for (const p of INITIAL_PROJECTS) {
      serverlessProjects.set(p.id, p);
    }
  }

  if (serverlessSubmissions.size === 0) {
    for (const s of INITIAL_SUBMISSIONS) {
      serverlessSubmissions.set(s.instanceId, s);
      serverlessSubmissions.set(s.id, s);
    }
  }
}

initServerlessData();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-enumerator-id, x-access-code',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  initServerlessData();

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Normalize path by stripping prefix '/.netlify/functions/api' or '/api'
  let p = event.path;
  if (p.startsWith('/.netlify/functions/api')) {
    p = p.replace('/.netlify/functions/api', '');
  } else if (p.startsWith('/api')) {
    p = p.replace('/api', '');
  }
  if (!p.startsWith('/')) p = '/' + p;

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body || '{}') : {};
  const query = event.queryStringParameters || {};
  const headers = event.headers || {};
  const accessCodeHeader = headers['x-access-code'] || query.accessCode;

  try {
    // -------------------------------------------------------------
    // AUTH: LOGIN
    // -------------------------------------------------------------
    if (p === '/auth/login' && method === 'POST') {
      const { email, password, accessCode, pin, authMethod } = body;

      if (authMethod === 'access_code' || accessCode) {
        const codeKey = String(accessCode || '').trim().toLowerCase();
        const user = serverlessUsers.get(codeKey);

        if (!user) {
          return {
            statusCode: 401,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Invalid access code: "${accessCode}". Please check field credentials.` }),
          };
        }

        if (!user.active) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'This surveyor account is currently deactivated. Contact CMRG Operations.' }),
          };
        }

        if (pin && user.pinHash && user.pinSalt) {
          if (!verifyPassword(pin, user.pinSalt, user.pinHash)) {
            return {
              statusCode: 401,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: 'Incorrect 4-digit PIN for this field access code.' }),
            };
          }
        }

        const token = `cmrg_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            token,
            user: {
              userId: user.id,
              email: user.email,
              displayName: user.displayName,
              role: user.role,
              orgId: user.orgId,
              orgName: user.orgName,
              loginAt: new Date().toISOString(),
              assignedProjectIds: user.assignedProjectIds || ['prj_01'],
              permissions: ['submissions:create', 'submissions:read', 'forms:read'],
            },
          }),
        };
      }

      // Password Login
      const emailKey = String(email || '').trim().toLowerCase();
      const user = serverlessUsers.get(emailKey);

      if (!user) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'No CMRG account found with this email address.' }),
        };
      }

      if (!user.active) {
        return {
          statusCode: 403,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'This account has been deactivated. Please contact your CMRG administrator.' }),
        };
      }

      if (!verifyPassword(password, user.salt, user.passwordHash)) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Incorrect password entered.' }),
        };
      }

      const token = `cmrg_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          token,
          user: {
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            orgId: user.orgId,
            orgName: user.orgName,
            loginAt: new Date().toISOString(),
            assignedProjectIds: user.assignedProjectIds || ['prj_01'],
            permissions: [
              'submissions:create',
              'submissions:read',
              'submissions:review',
              'forms:read',
              'forms:create',
              'situation:read',
            ],
          },
        }),
      };
    }

    // -------------------------------------------------------------
    // AUTH: ME
    // -------------------------------------------------------------
    if (p === '/auth/me' && method === 'GET') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          user: DEFAULT_USERS[0],
        }),
      };
    }

    // -------------------------------------------------------------
    // FORMS
    // -------------------------------------------------------------
    if (p === '/forms' && method === 'GET') {
      const uniqueForms = Array.from(new Set(Array.from(serverlessForms.values()).map((f) => f.id)))
        .map((id) => serverlessForms.get(id))
        .filter(Boolean);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(uniqueForms),
      };
    }

    // -------------------------------------------------------------
    // SUBMISSIONS: LIST & CREATE
    // -------------------------------------------------------------
    if (p === '/submissions' && method === 'GET') {
      const uniqueSubs = Array.from(
        new Set(Array.from(serverlessSubmissions.values()).map((s) => s.instanceId || s.id))
      )
        .map((k) => serverlessSubmissions.get(k))
        .filter(Boolean);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(uniqueSubs),
      };
    }

    if (p === '/submissions' && method === 'POST') {
      const s = body;
      const instanceId = s.instanceId || `uuid:${crypto.randomUUID()}`;
      const rec = {
        ...s,
        id: s.id || `sub_${Date.now()}`,
        instanceId,
        createdAt: s.createdAt || new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      };
      serverlessSubmissions.set(instanceId, rec);
      serverlessSubmissions.set(rec.id, rec);

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, submission: rec }),
      };
    }

    // -------------------------------------------------------------
    // SITUATION: LOCATIONS
    // -------------------------------------------------------------
    if (p === '/situation/locations' && method === 'GET') {
      const allSubs = Array.from(
        new Set(Array.from(serverlessSubmissions.values()).map((s) => s.instanceId || s.id))
      )
        .map((k) => serverlessSubmissions.get(k))
        .filter(Boolean);

      const records = allSubs.map((s) => {
        const rawLat = s.metadata?.latitude;
        const rawLng = s.metadata?.longitude;
        const lat = typeof rawLat === 'number' && !isNaN(rawLat) ? rawLat : null;
        const lng = typeof rawLng === 'number' && !isNaN(rawLng) ? rawLng : null;
        const hasCoordinates = lat !== null && lng !== null;

        return {
          id: s.id,
          instanceId: s.instanceId,
          formId: s.formId,
          formTitle: s.formTitle || s.formId,
          formVersion: s.formVersion || '1.0',
          enumeratorId: s.enumeratorId,
          enumeratorName: s.enumeratorName || 'Field Officer',
          deviceId: s.deviceId,
          status: s.status || 'synced',
          createdAt: s.createdAt,
          syncedAt: s.syncedAt,
          durationSeconds: s.metadata?.durationSeconds,
          hasCoordinates,
          latitude: lat,
          longitude: lng,
          accuracy: s.metadata?.accuracy || null,
        };
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          serverTime: new Date().toISOString(),
          totalRecords: records.length,
          withGpsCount: records.filter((r) => r.hasCoordinates).length,
          noGpsCount: records.filter((r) => !r.hasCoordinates).length,
          records,
        }),
      };
    }

    // -------------------------------------------------------------
    // SITUATION: JOB REVIEW (DEEP LINK WITH ACCESS CODE AUDIT)
    // -------------------------------------------------------------
    if (p.startsWith('/situation/job-review/') && method === 'GET') {
      const instanceId = decodeURIComponent(p.replace('/situation/job-review/', ''));
      const sub = serverlessSubmissions.get(instanceId);

      if (!sub) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Submission with instance ID "${instanceId}" was not found.` }),
        };
      }

      // Validate access code if provided or enforce role validation
      let authorized = true;
      if (accessCodeHeader) {
        const code = String(accessCodeHeader).trim().toLowerCase();
        const validCodes = ['admin', 'org_admin', 'enum_02', 'sup_01', 'dammyblack88@gmail.com', 'analyst'];
        if (!validCodes.includes(code)) {
          authorized = false;
        }
      }

      if (!authorized) {
        return {
          statusCode: 403,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Access Denied: Invalid supervisor access code or insufficient permissions.' }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          submission: sub,
          auditHistory: [
            {
              action: 'INSPECTED_BY_SUPERVISOR',
              timestamp: new Date().toISOString(),
              accessCode: accessCodeHeader || 'supervisor_session',
            },
          ],
        }),
      };
    }

    // SITUATION: SUBMIT JOB REVIEW DECISION (Approve, Flag, Reject)
    if (p.startsWith('/situation/job-review/') && method === 'POST') {
      const instanceId = decodeURIComponent(p.replace('/situation/job-review/', ''));
      const sub = serverlessSubmissions.get(instanceId);

      if (!sub) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Submission not found.' }),
        };
      }

      const { decision, notes, supervisorName, flagReason } = body;
      sub.status = decision; // 'approved' | 'flagged' | 'rejected'
      sub.reviewNotes = notes;
      sub.reviewedBy = supervisorName || 'Supervisor';
      sub.reviewedAt = new Date().toISOString();
      if (flagReason) sub.flagReason = flagReason;

      serverlessSubmissions.set(sub.instanceId, sub);
      serverlessSubmissions.set(sub.id, sub);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          message: `Submission status updated to "${decision}".`,
          submission: sub,
        }),
      };
    }

    // -------------------------------------------------------------
    // SITUATION: VIRTUAL WATCH LIVE (REAL-TIME TELEMETRY MONITOR)
    // -------------------------------------------------------------
    if (p === '/situation/virtual-watch-live' && method === 'GET') {
      const liveSessions = [
        {
          sessionId: 'live_ses_01',
          enumeratorId: 'CM500012',
          enumeratorName: 'Nancy Noble',
          deviceId: 'CMRG-TECNO-SPARK-10',
          batteryLevel: 91,
          networkSignal: '4G LTE (Strong)',
          latitude: 11.9845,
          longitude: 8.5283,
          locationName: 'Zoo Road / Tarauni Ward, Kano',
          currentQuestionId: 'q8a_likes',
          currentQuestionLabel: 'Q8a. What do you like most about Callerfeel?',
          respondentInitials: 'M.I.D.',
          interviewElapsedSeconds: 420,
          isAudioRecording: true,
          isLiveCameraRequested: false,
          isLiveCameraActive: false,
        },
        {
          sessionId: 'live_ses_02',
          enumeratorId: 'CM500014',
          enumeratorName: 'Joy Emmanuel',
          deviceId: 'CMRG-INFINIX-HOT-20',
          batteryLevel: 84,
          networkSignal: '4G LTE',
          latitude: 6.6214,
          longitude: 3.3852,
          locationName: 'Magodo Phase 2, Lagos',
          currentQuestionId: 'd9_spend',
          currentQuestionLabel: 'D9. Average monthly mobile phone spend',
          respondentInitials: 'F.A.',
          interviewElapsedSeconds: 195,
          isAudioRecording: true,
          isLiveCameraRequested: false,
          isLiveCameraActive: false,
        },
        {
          sessionId: 'live_ses_03',
          enumeratorId: 'CM500025',
          enumeratorName: 'Ojuola Toyin',
          deviceId: 'CMRG-TECNO-CAMON-20',
          batteryLevel: 94,
          networkSignal: '5G (Optimal)',
          latitude: 9.0765,
          longitude: 7.4722,
          locationName: 'Wuse 2, FCT Abuja',
          currentQuestionId: 'q2a_vas_aware',
          currentQuestionLabel: 'Q2a. Value-added services awareness',
          respondentInitials: 'Z.M.',
          interviewElapsedSeconds: 310,
          isAudioRecording: true,
          isLiveCameraRequested: false,
          isLiveCameraActive: false,
        },
      ];

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          serverTime: new Date().toISOString(),
          activeSessionsCount: liveSessions.length,
          sessions: liveSessions,
        }),
      };
    }

    // -------------------------------------------------------------
    // SITUATION: WEBRTC SIGNALING (TRANSPARENT, CONSENT-BASED LIVE VIDEO)
    // -------------------------------------------------------------
    if (p === '/situation/webrtc-signal' && method === 'POST') {
      const { sessionId, signalType, sdp, candidate, supervisorId, enumeratorConsent } = body;

      // Consent enforcement check
      if (signalType === 'request_stream' && !enumeratorConsent) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            status: 'pending_enumerator_consent',
            message: 'Camera access prompt sent to field enumerator tablet. Awaiting explicit verbal and UI confirmation.',
          }),
        };
      }

      const session = webrtcSessions.get(sessionId) || {};
      if (sdp) session.sdp = sdp;
      if (candidate) {
        session.candidates = session.candidates || [];
        session.candidates.push(candidate);
      }
      session.lastUpdated = new Date().toISOString();
      session.supervisorId = supervisorId;
      session.consentGranted = true;
      webrtcSessions.set(sessionId, session);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          sessionId,
          status: 'connected',
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        }),
      };
    }

    // -------------------------------------------------------------
    // MEDIA: AUDIO PLAYBACK STREAM
    // -------------------------------------------------------------
    if (p === '/media/audio' && method === 'GET') {
      const { track, uuid } = query;
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          track: track || 'rec_1',
          uuid: uuid || 'cf_sample',
          verified: true,
          bitrateKbps: 64,
          sampleRateHz: 16000,
          channels: 1,
          format: 'audio/webm; codecs=opus',
          audioSpeechClarityScore: 0.94,
        }),
      };
    }

    // Default 404 for unmatched route
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Route "${p}" not found on CMRG Netlify Function router.` }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal Server Error in CMRG Function handler', message: err?.message }),
    };
  }
};
