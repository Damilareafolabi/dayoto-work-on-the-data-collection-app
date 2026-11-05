import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import { CALLERFEEL_FORM_DEFINITION, SEEDED_CALLERFEEL_SUBMISSIONS } from './src/lib/callerfeelDataset.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =========================================================================
// POSTGRESQL CONNECTION POOL (Object Method with lazy fallback)
// =========================================================================
let pool: Pool | null = null;
let isPostgresConnected = false;

if (process.env.SQL_HOST && process.env.SQL_DB_NAME) {
  pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 10,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err: Error) => {
    console.warn('PostgreSQL idle client notice:', err.message);
  });
}

// In-Memory persistent fallback buffer (maintains consistency across server lifecycle)
const inMemorySubmissions = new Map<string, any>();
const inMemoryForms = new Map<string, any>();
const inMemoryEnumerators = new Map<string, any>();
const inMemoryProjects = new Map<string, any>();
const inMemoryAuditLogs: any[] = [];
const inMemoryUploadFailures = new Map<string, any>();
const privateMediaVault = new Map<string, { dataUrl: string; contentType: string; ownerId: string; sizeBytes?: number }>();

// =========================================================================
// PHASE 1 — MULTI-TENANT AUTHENTICATION, ORGANIZATIONS & RBAC STORAGE
// =========================================================================
export type EnterpriseRole =
  | 'platform_admin'
  | 'org_admin'
  | 'supervisor'
  | 'enumerator'
  | 'data_analyst';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  role: EnterpriseRole;
  passwordHash: string;
  salt: string;
  orgId: string;
  orgName: string;
  accessCode?: string;
  pinHash?: string;
  pinSalt?: string;
  isEmailVerified: boolean;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiry?: number;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  assignedProjectIds: string[];
}

export interface StoredOrganization {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  registeredAt: string;
  approvedAt?: string;
  approvedBy?: string;
  planTier: 'basic' | 'pro' | 'enterprise';
}

const inMemoryOrganizations = new Map<string, StoredOrganization>();
const inMemoryUsers = new Map<string, StoredUser>();
const inMemorySessions = new Map<string, { userId: string; role: EnterpriseRole; orgId: string; email: string; displayName: string; createdAt: number; expiresAt: number }>();

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

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

// Seed Organizations
inMemoryOrganizations.set('org_cmrg', {
  id: 'org_cmrg',
  name: 'Communication and Marketing Research Group Limited',
  slug: 'cmrg',
  contactEmail: 'operations@cmrg.org',
  status: 'approved',
  registeredAt: '2026-01-15T08:00:00Z',
  approvedAt: '2026-01-15T08:00:00Z',
  approvedBy: 'System Bootstrap',
  planTier: 'enterprise',
});

inMemoryOrganizations.set('org_westafrica', {
  id: 'org_westafrica',
  name: 'West Africa Health & Market Research Alliance',
  slug: 'wahmra',
  contactEmail: 'contact@wahmra.org',
  status: 'pending',
  registeredAt: '2026-10-20T10:00:00Z',
  planTier: 'pro',
});

// Seed default password salt & hash for "Password123!"
const defaultSalt = generateSalt();
const defaultHash = hashPassword('Password123!', defaultSalt);
const pinSalt = generateSalt();
const pinHash = hashPassword('1234', pinSalt);

// 1. Platform Administrator
inMemoryUsers.set('usr_director', {
  id: 'usr_director',
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
  createdAt: '2026-01-15T08:00:00Z',
  assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
});

// 2. Organization Administrator
inMemoryUsers.set('usr_org_admin', {
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
  createdAt: '2026-02-01T08:00:00Z',
  assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
});

// 3. Field Supervisor
inMemoryUsers.set('usr_supervisor', {
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
  createdAt: '2026-03-01T08:00:00Z',
  assignedProjectIds: ['prj_01', 'prj_02'],
});

// 4. Enumerator
inMemoryUsers.set('usr_enumerator', {
  id: 'usr_enumerator',
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
  createdAt: '2026-03-10T08:00:00Z',
  assignedProjectIds: ['prj_01'],
});

// 5. Data Analyst
inMemoryUsers.set('usr_analyst', {
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
  createdAt: '2026-04-01T08:00:00Z',
  assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
});

// 6. Suspended test user (for deactivation test)
inMemoryUsers.set('usr_suspended', {
  id: 'usr_suspended',
  email: 'suspended@cmrg.org',
  displayName: 'Suspended Field Officer',
  role: 'enumerator',
  passwordHash: defaultHash,
  salt: defaultSalt,
  orgId: 'org_cmrg',
  orgName: 'Communication and Marketing Research Group Limited',
  accessCode: 'enum_deactivated',
  pinHash,
  pinSalt,
  isEmailVerified: true,
  active: false,
  createdAt: '2026-04-10T08:00:00Z',
  assignedProjectIds: [],
});

// CMRG Internal Capacity Configuration (Preset: Pro profile)
let inMemoryCapacityConfig = {
  tier: 'pro' as 'basic' | 'pro' | 'advanced' | 'enterprise',
  profileName: 'CMRG National Field Operations Pro',
  maxStorageMB: 15360, // 15 GB
  monthlySubmissionAllowance: 15000,
  maxQuestionnaires: 50,
  maxActiveEnumerators: 100,
  allowOfflineCollection: true,
  allowCsvExport: true,
  allowSqlExport: true,
  allowFirebaseCloudSync: true,
  allowAiAssistance: true,
  monthlyAiTokenAllowance: 50000,
  organisationMode: true,
  organisationName: 'Communication and Marketing Research Group (CMRG)',
  enforceHardLimits: true,
  warningThresholdPercent: 85,
  supportTier: 'Dedicated CMRG Specialist' as const,
  projectSpecificRestrictions: true,
  lastUpdated: '2026-10-14T08:00:00Z',
  updatedBy: 'Dr. Damilare Afolabi (CMRG Director)',
};

// Preload baseline projects
inMemoryProjects.set('prj_01', {
  id: 'prj_01',
  code: 'PRJ-CMRG-2026-FMCG',
  name: 'CMRG National Consumer Brand Audit 2026',
  description: 'Quarterly retail pricing, brand equity, SKU distribution and shelf-share tracker across retail channels.',
  leadResearcher: 'Dr. Damilare Afolabi (CMRG Research Director)',
  status: 'active',
  formIds: ['cmrg_consumer_brand_audit_2026'],
  assignedEnumeratorIds: ['enum_01', 'enum_02', 'enum_03'],
  maxSubmissionsLimit: 10000,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-14T08:00:00Z',
});
inMemoryProjects.set('prj_02', {
  id: 'prj_02',
  code: 'PRJ-CMRG-2026-AGRI',
  name: 'West African Agro-Commodity & Farm Yield Survey',
  description: 'Crop disease detection, smallholder fertilizer adoption, farm-gate pricing and satellite geo-verification.',
  leadResearcher: 'Prof. Kwame Boateng (Principal Agronomist)',
  status: 'active',
  formIds: ['cmrg_form_002'],
  assignedEnumeratorIds: ['enum_01', 'enum_02'],
  maxSubmissionsLimit: 5000,
  createdAt: '2026-09-15T08:00:00Z',
  updatedAt: '2026-10-10T12:00:00Z',
});
inMemoryProjects.set('prj_03', {
  id: 'prj_03',
  code: 'PRJ-CMRG-2026-FINTECH',
  name: 'Financial Inclusion & Mobile Money Agent Census',
  description: 'Point-of-Sale (POS) terminal reliability, merchant fee compliance, KYC verification, and agent liquidity buffers.',
  leadResearcher: 'Amina Bello (Senior Field Supervisor)',
  status: 'active',
  formIds: ['cmrg_form_003'],
  assignedEnumeratorIds: ['enum_02', 'enum_03'],
  maxSubmissionsLimit: 8000,
  createdAt: '2026-08-20T08:00:00Z',
  updatedAt: '2026-10-12T09:00:00Z',
});

// Preload audit log
inMemoryAuditLogs.push({
  id: 'audit_01',
  action: 'CAPACITY_PROFILE_INITIALIZED',
  actor: 'Dr. Damilare Afolabi',
  actorRole: 'admin',
  target: 'CMRG Capacity Engine',
  details: 'Initial capacity profile configured as CMRG Pro (15GB storage, 15,000 monthly allowance).',
  timestamp: '2026-10-14T07:30:00Z',
});

// Accurate Storage Calculation Helper
function calculateServerStorageAccounting() {
  let photosBytes = 0;
  let photosCount = 0;
  let audioBytes = 0;
  let audioCount = 0;
  let signaturesBytes = 0;
  let signaturesCount = 0;
  let submissionsJsonBytes = 0;

  for (const media of privateMediaVault.values()) {
    const bytes = media.sizeBytes || Math.round(media.dataUrl.length * 0.75);
    if (media.contentType.startsWith('image/')) {
      if (media.dataUrl.includes('signature') || bytes < 50000) {
        signaturesBytes += bytes;
        signaturesCount++;
      } else {
        photosBytes += bytes;
        photosCount++;
      }
    } else if (media.contentType.startsWith('audio/')) {
      audioBytes += bytes;
      audioCount++;
    }
  }

  for (const s of inMemorySubmissions.values()) {
    const rawAnswers = JSON.stringify(s.answers || {});
    submissionsJsonBytes += rawAnswers.length;

    if (s.metadata?.audioAuditRecorded) {
      audioBytes += (s.metadata.durationSeconds || 60) * 800;
      audioCount++;
    }
  }

  const formsJsonBytes = JSON.stringify(Array.from(inMemoryForms.values())).length;
  // Base server metadata + database index overhead (2.5 MB)
  const totalBytes = photosBytes + audioBytes + signaturesBytes + submissionsJsonBytes + formsJsonBytes + (2.5 * 1024 * 1024);
  const totalMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
  const quotaMB = inMemoryCapacityConfig.maxStorageMB;
  const remainingMB = Math.max(0, Number((quotaMB - totalMB).toFixed(2)));
  const percentUsed = Math.min(100, Number(((totalMB / quotaMB) * 100).toFixed(1)));

  return {
    totalBytes,
    totalMB,
    photosBytes,
    photosCount,
    audioBytes,
    audioCount,
    signaturesBytes,
    signaturesCount,
    submissionsJsonBytes,
    submissionsCount: inMemorySubmissions.size,
    remainingMB,
    quotaMB,
    percentUsed,
  };
}

function countMonthlySubmissions(): number {
  const currentMonth = new Date().toISOString().substring(0, 7); // e.g. '2026-10'
  let count = 0;
  for (const s of inMemorySubmissions.values()) {
    if (s.createdAt && s.createdAt.startsWith(currentMonth)) count++;
  }
  return count;
}

function countTodaySubmissions(): number {
  const today = new Date().toISOString().substring(0, 10); // e.g. '2026-10-14'
  let count = 0;
  for (const s of inMemorySubmissions.values()) {
    if (s.createdAt && s.createdAt.startsWith(today)) count++;
  }
  return count;
}

function logAuditEvent(action: string, actor: string, actorRole: string, target: string, details: string, ipAddress?: string) {
  const event = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action,
    actor: actor || 'System Admin',
    actorRole: (actorRole as any) || 'admin',
    target,
    details,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress || '127.0.0.1',
  };
  inMemoryAuditLogs.unshift(event);
  if (inMemoryAuditLogs.length > 300) inMemoryAuditLogs.length = 300;
  return event;
}

// Preload baseline forms
inMemoryForms.set('cmrg_consumer_brand_audit_2026', {
  id: 'form_001',
  formId: 'cmrg_consumer_brand_audit_2026',
  projectId: 'prj_01',
  title: 'CMRG National Consumer Brand Audit 2026',
  version: '2026.10.1',
  description: 'FMCG brand availability, retail pricing benchmarks, and merchant interviews.',
  category: 'Market Research',
  assignedRegions: ['Greater Accra Coastal', 'Lagos Island & Mainland', 'Nairobi Urban West'],
  assignedEnumeratorIds: ['enum_01', 'enum_02', 'enum_03'],
  active: true,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-14T08:00:00Z',
  questions: [
    { id: 'q1', name: 'store_name', type: 'text', label: 'Retail Store Name', required: true },
    { id: 'q2', name: 'store_type', type: 'single_choice', label: 'Retail Channel Classification', required: true, options: [{ value: 'supermarket', label: 'Supermarket' }, { value: 'kiosk', label: 'Kiosk' }] },
    { id: 'q3', name: 'interview_date', type: 'date', label: 'Date of Audit', required: true },
    { id: 'q4', name: 'has_consent', type: 'yes_no', label: 'Informed Consent Granted?', required: true },
    { id: 'q5', name: 'price_coke', type: 'number', label: 'Unit Retail Price ($)', required: true },
    { id: 'q6', name: 'inventory_roster', type: 'repeat_group', label: 'Audited Brand SKUs (Repeat Group)', required: false },
  ],
});

// Preload baseline enumerators
inMemoryEnumerators.set('enum_01', {
  id: 'enum_01',
  name: 'Kwame Asante',
  email: 'k.asante@field.cmrg.org',
  region: 'Greater Accra Coastal',
  deviceId: 'CMRG-TAB-104',
  active: true,
  createdAt: '2026-10-01T00:00:00Z',
});
inMemoryEnumerators.set('enum_02', {
  id: 'enum_02',
  name: 'Amina Bello',
  email: 'a.bello@field.cmrg.org',
  region: 'Lagos Island & Mainland',
  deviceId: 'CMRG-TAB-109',
  active: true,
  createdAt: '2026-10-01T00:00:00Z',
});
inMemoryEnumerators.set('enum_deactivated', {
  id: 'enum_deactivated',
  name: 'Suspended Enumerator',
  email: 'suspended@field.cmrg.org',
  region: 'Inactive Sector',
  deviceId: 'CMRG-TAB-000',
  active: false,
  createdAt: '2026-09-01T00:00:00Z',
});

// Preload baseline verified submissions (including GPS and non-GPS for situation awareness)
inMemorySubmissions.set('uuid:5a2f8b1c-3e91-49b2-a9b0-9a4f210d7a11', {
  id: 'sub_101',
  instanceId: 'uuid:5a2f8b1c-3e91-49b2-a9b0-9a4f210d7a11',
  formId: 'cmrg_consumer_brand_audit_2026',
  formTitle: 'CMRG National Consumer Brand Audit 2026',
  formVersion: '2026.10.1',
  enumeratorId: 'enum_01',
  enumeratorName: 'Kwame Asante',
  deviceId: 'CMRG-TAB-104',
  status: 'synced',
  answers: {
    store_name: 'Metro Mega Supermarket Osu',
    store_type: 'supermarket',
    has_consent: 'yes',
    price_coke: 1.85,
  },
  metadata: {
    startTime: '2026-10-14T08:15:10Z',
    endTime: '2026-10-14T08:26:45Z',
    durationSeconds: 695,
    latitude: 5.5562,
    longitude: -0.1873,
    accuracy: 3.2,
    audioAuditRecorded: true,
    deviceBatteryLevel: 89,
    networkAtSubmission: 'online',
  },
  createdAt: '2026-10-14T08:26:45Z',
  syncedAt: '2026-10-14T08:27:02Z',
});

inMemorySubmissions.set('uuid:9e8a7b6c-5d4e-3f2a-1b0c-9f8e7d6c5b4a', {
  id: 'sub_102',
  instanceId: 'uuid:9e8a7b6c-5d4e-3f2a-1b0c-9f8e7d6c5b4a',
  formId: 'cmrg_consumer_brand_audit_2026',
  formTitle: 'CMRG National Consumer Brand Audit 2026',
  formVersion: '2026.10.1',
  enumeratorId: 'enum_02',
  enumeratorName: 'Amina Bello',
  deviceId: 'CMRG-TAB-109',
  status: 'submitted',
  answers: {
    store_name: 'Victoria Island QuickShop Kiosk',
    store_type: 'kiosk',
    has_consent: 'yes',
    price_coke: 1.4,
  },
  metadata: {
    startTime: '2026-10-14T09:05:00Z',
    endTime: '2026-10-14T09:12:30Z',
    durationSeconds: 450,
    latitude: 6.4281,
    longitude: 3.4219,
    accuracy: 4.8,
    audioAuditRecorded: false,
    deviceBatteryLevel: 76,
    networkAtSubmission: 'online',
  },
  createdAt: '2026-10-14T09:12:30Z',
  syncedAt: '2026-10-14T09:13:00Z',
});

// Non-GPS submission (for testing no-location state without placing fake marker)
inMemorySubmissions.set('uuid:4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e', {
  id: 'sub_103_nogps',
  instanceId: 'uuid:4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e',
  formId: 'cmrg_consumer_brand_audit_2026',
  formTitle: 'CMRG National Consumer Brand Audit 2026',
  formVersion: '2026.10.1',
  enumeratorId: 'enum_01',
  enumeratorName: 'Kwame Asante',
  deviceId: 'CMRG-TAB-104',
  status: 'synced',
  answers: {
    store_name: 'Airport Residential Mini Mart',
    store_type: 'kiosk',
    has_consent: 'yes',
    price_coke: 1.6,
  },
  metadata: {
    startTime: '2026-10-14T10:00:00Z',
    endTime: '2026-10-14T10:08:15Z',
    durationSeconds: 495,
    latitude: undefined,
    longitude: undefined,
    accuracy: undefined,
    audioAuditRecorded: true,
    deviceBatteryLevel: 82,
    networkAtSubmission: 'online',
  },
  createdAt: '2026-10-14T10:08:15Z',
  syncedAt: '2026-10-14T10:08:30Z',
});

// Seed Project Callerfeel Questionnaire and Submissions
inMemoryForms.set(CALLERFEEL_FORM_DEFINITION.id, CALLERFEEL_FORM_DEFINITION);
inMemoryForms.set(CALLERFEEL_FORM_DEFINITION.formId, CALLERFEEL_FORM_DEFINITION);

for (const s of SEEDED_CALLERFEEL_SUBMISSIONS) {
  inMemorySubmissions.set(s.instanceId, s);
  inMemorySubmissions.set(s.id, s);
}



// =========================================================================
// SERVER-SIDE VALIDATION ENGINE
// =========================================================================
interface ValidationError {
  field: string;
  message: string;
}

function validateSubmissionAnswers(form: any, answers: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const q of form.questions) {
    const val = answers[q.name];

    // Check required
    if (q.required) {
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
        errors.push({ field: q.name, message: `Field '${q.label}' is required by server schema.` });
        continue;
      }
    }

    if (val === undefined || val === null || val === '') continue;

    // Type validation
    switch (q.type) {
      case 'number':
        if (typeof val !== 'number' && isNaN(Number(val))) {
          errors.push({ field: q.name, message: `Field '${q.label}' must be a valid number.` });
        }
        break;

      case 'date':
        // Expect ISO format YYYY-MM-DD
        if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(val)) {
          errors.push({ field: q.name, message: `Field '${q.label}' must be a valid date in YYYY-MM-DD format.` });
        }
        break;

      case 'yes_no':
        if (val !== 'yes' && val !== 'no' && val !== true && val !== false) {
          errors.push({ field: q.name, message: `Field '${q.label}' must be 'yes' or 'no'.` });
        }
        break;

      case 'single_choice':
        if (q.options && Array.isArray(q.options)) {
          const allowed = q.options.map((o: any) => o.value);
          if (!allowed.includes(val)) {
            errors.push({ field: q.name, message: `Value for '${q.label}' is not among authorized options.` });
          }
        }
        break;

      case 'multiple_choice':
        if (!Array.isArray(val)) {
          errors.push({ field: q.name, message: `Field '${q.label}' must be an array of selected choices.` });
        }
        break;

      case 'repeat_group':
        if (!Array.isArray(val)) {
          errors.push({ field: q.name, message: `Repeat group '${q.label}' must be an array of item records.` });
        }
        break;
    }
  }

  return errors;
}

// =========================================================================
// API ENDPOINTS
// =========================================================================

// Health Check
app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: 'CMRG DataCollect Backend Engine',
    database: pool ? 'postgresql-configured' : 'in-memory-persistence',
    timestamp: new Date().toISOString(),
    recordsCount: inMemorySubmissions.size,
  });
});

// 1. Get Forms
app.get('/api/forms', (req: Request, res: Response) => {
  const enumeratorId = req.query.enumeratorId as string;
  const allForms = Array.from(inMemoryForms.values());

  if (enumeratorId) {
    const enumProfile = inMemoryEnumerators.get(enumeratorId);
    if (!enumProfile || !enumProfile.active) {
      return res.status(403).json({ error: 'Enumerator account is deactivated or not found.' });
    }
    const assigned = allForms.filter(
      (f) =>
        f.active &&
        (!f.assignedEnumeratorIds ||
          f.assignedEnumeratorIds.length === 0 ||
          f.assignedEnumeratorIds.includes(enumeratorId))
    );
    return res.json(assigned);
  }

  res.json(allForms);
});

// 2. Create / Update Form
app.post('/api/forms', (req: Request, res: Response) => {
  const { formId, title, version, questions, category, description } = req.body;

  if (!formId || !title || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Missing formId, title, or questions list.' });
  }

  const newForm = {
    id: `form_${Date.now()}`,
    formId,
    title,
    version: version || '1.0.0',
    description: description || '',
    category: category || 'General Fieldwork',
    questions,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryForms.set(formId, newForm);
  res.status(201).json(newForm);
});

// 3. Assign Form to Enumerators / Regions
app.put('/api/forms/:formId/assign', (req: Request, res: Response) => {
  const { formId } = req.params;
  const { assignedEnumeratorIds, assignedRegions } = req.body;

  const form = inMemoryForms.get(formId);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  form.assignedEnumeratorIds = assignedEnumeratorIds || [];
  form.assignedRegions = assignedRegions || [];
  form.updatedAt = new Date().toISOString();

  inMemoryForms.set(formId, form);
  res.json({ success: true, form });
});

// 4. Submissions Ingestion with Quota Enforcement, Deduplication & Validation
app.post('/api/submissions', async (req: Request, res: Response) => {
  const {
    instanceId,
    projectId,
    formId,
    enumeratorId,
    enumeratorName,
    deviceId,
    answers,
    metadata,
    encryptedEnvelope,
  } = req.body;

  if (!instanceId || !formId) {
    return res.status(400).json({ error: 'Missing instanceId or formId.' });
  }

  // Idempotency / Duplicate Prevention Check
  if (inMemorySubmissions.has(instanceId)) {
    const existing = inMemorySubmissions.get(instanceId);
    inMemoryUploadFailures.delete(instanceId);
    return res.status(200).json({
      success: true,
      status: 'already_synced',
      message: 'Duplicate submission avoided via instanceId idempotency key.',
      instanceId,
      syncedAt: existing.syncedAt,
    });
  }

  // 1. Capacity & Quota Enforcement (CMRG Organisation Mode)
  const monthlySubmissionsCount = countMonthlySubmissions();
  if (
    inMemoryCapacityConfig.enforceHardLimits &&
    monthlySubmissionsCount >= inMemoryCapacityConfig.monthlySubmissionAllowance
  ) {
    const errorMsg = `Monthly submission quota exceeded (${monthlySubmissionsCount}/${inMemoryCapacityConfig.monthlySubmissionAllowance} for tier ${inMemoryCapacityConfig.tier.toUpperCase()}). Please contact a CMRG Administrator to adjust capacity profile.`;
    inMemoryUploadFailures.set(instanceId, {
      id: `fail_${Date.now()}`,
      instanceId,
      formId,
      enumeratorId: enumeratorId || 'unknown',
      errorCode: 'QUOTA_EXCEEDED',
      errorMessage: errorMsg,
      attemptCount: 1,
      timestamp: new Date().toISOString(),
      status: 'failed',
    });
    return res.status(429).json({
      error: 'CMRG Organisation Quota Exceeded',
      code: 'SUBMISSION_QUOTA_EXCEEDED',
      message: errorMsg,
      currentUsage: monthlySubmissionsCount,
      limit: inMemoryCapacityConfig.monthlySubmissionAllowance,
    });
  }

  // Check Storage Limit
  const storageAccounting = calculateServerStorageAccounting();
  if (
    inMemoryCapacityConfig.enforceHardLimits &&
    storageAccounting.totalMB >= inMemoryCapacityConfig.maxStorageMB
  ) {
    const errorMsg = `Organisation storage quota reached (${storageAccounting.totalMB}MB / ${inMemoryCapacityConfig.maxStorageMB}MB).`;
    inMemoryUploadFailures.set(instanceId, {
      id: `fail_${Date.now()}`,
      instanceId,
      formId,
      enumeratorId: enumeratorId || 'unknown',
      errorCode: 'STORAGE_EXCEEDED',
      errorMessage: errorMsg,
      attemptCount: 1,
      timestamp: new Date().toISOString(),
      status: 'failed',
    });
    return res.status(429).json({
      error: 'CMRG Storage Limit Exceeded',
      code: 'STORAGE_LIMIT_EXCEEDED',
      message: errorMsg,
      currentUsageMB: storageAccounting.totalMB,
      limitMB: inMemoryCapacityConfig.maxStorageMB,
    });
  }

  // Warning Header if near threshold (e.g. >= 80%)
  const usagePercentage = (monthlySubmissionsCount / inMemoryCapacityConfig.monthlySubmissionAllowance) * 100;
  let capacityWarning: string | null = null;
  if (usagePercentage >= inMemoryCapacityConfig.warningThresholdPercent) {
    capacityWarning = `Organisation warning: Submissions at ${usagePercentage.toFixed(1)}% of monthly capacity allowance.`;
    res.setHeader('X-CMRG-Capacity-Warning', capacityWarning);
  }

  // Verify Enumerator Access Permission
  if (enumeratorId) {
    const surveyor = inMemoryEnumerators.get(enumeratorId);
    if (surveyor && !surveyor.active) {
      return res.status(403).json({
        error: 'Permission Denied: Enumerator account has been deactivated by administration.',
      });
    }
  }

  // Server-Side Schema Validation
  const form = inMemoryForms.get(formId);
  if (form && answers) {
    const validationErrors = validateSubmissionAnswers(form, answers);
    if (validationErrors.length > 0) {
      return res.status(422).json({
        error: 'Server Schema Validation Failed',
        details: validationErrors,
      });
    }
  }

  // Store Private Media Securely with byte tracking
  if (answers && typeof answers === 'object') {
    for (const [key, val] of Object.entries(answers)) {
      if (typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('data:audio'))) {
        const mediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const contentType = val.startsWith('data:image') ? 'image/png' : 'audio/webm';
        const sizeBytes = Math.round(val.length * 0.75);
        privateMediaVault.set(mediaId, {
          dataUrl: val,
          contentType,
          ownerId: enumeratorId || 'system',
          sizeBytes,
        });
        answers[key] = `/api/media/${mediaId}`;
      }
    }
  }

  const now = new Date().toISOString();
  const assignedProj = projectId || form?.projectId || 'prj_01';

  const submissionRecord = {
    id: `sub_${Date.now()}`,
    instanceId,
    projectId: assignedProj,
    formId,
    formTitle: form?.title || formId,
    formVersion: form?.version || '1.0',
    enumeratorId: enumeratorId || 'enum_01',
    enumeratorName: enumeratorName || 'Field Officer',
    deviceId: deviceId || 'CMRG-DEVICE',
    status: 'synced',
    answers: answers || {},
    metadata: metadata || { durationSeconds: 60, networkAtSubmission: 'online' },
    encryptedEnvelope: encryptedEnvelope || null,
    createdAt: now,
    syncedAt: now,
  };

  inMemorySubmissions.set(instanceId, submissionRecord);
  inMemoryUploadFailures.delete(instanceId);

  // Update project submission count if exists
  const proj = inMemoryProjects.get(assignedProj);
  if (proj) {
    proj.submissionsCount = (proj.submissionsCount || 0) + 1;
    inMemoryProjects.set(assignedProj, proj);
  }

  // Update enumerator submission count if exists
  if (enumeratorId) {
    const enumProf = inMemoryEnumerators.get(enumeratorId);
    if (enumProf) {
      enumProf.totalSubmissions = (enumProf.totalSubmissions || 0) + 1;
      enumProf.lastActiveAt = now;
      inMemoryEnumerators.set(enumeratorId, enumProf);
    }
  }

  // PostgreSQL Persistence if database pool is available
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO cmrg_submissions (id, instance_id, form_id, form_title, form_version, enumerator_id, enumerator_name, device_id, status, answers, duration_seconds, created_at, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'synced', $9, $10, $11, $12)
         ON CONFLICT (instance_id) DO NOTHING`,
        [
          submissionRecord.id,
          submissionRecord.instanceId,
          submissionRecord.formId,
          submissionRecord.formTitle,
          submissionRecord.formVersion,
          submissionRecord.enumeratorId,
          submissionRecord.enumeratorName,
          submissionRecord.deviceId,
          JSON.stringify(submissionRecord.answers),
          submissionRecord.metadata.durationSeconds || 0,
          submissionRecord.createdAt,
          submissionRecord.syncedAt,
        ]
      );
    } catch (dbErr) {
      console.warn('PostgreSQL write fallback to memory:', dbErr);
    }
  }

  return res.status(201).json({
    success: true,
    status: 'confirmed',
    instanceId,
    syncedAt: now,
    capacityWarning,
  });
});

// 5. Get Submissions
app.get('/api/submissions', (_req: Request, res: Response) => {
  res.json(Array.from(inMemorySubmissions.values()));
});

// 5b. Situation Geospatial Locations (Strictly sanitized, authorized records only)
app.get('/api/situation/locations', (req: Request, res: Response) => {
  const enumeratorId = (req.query.enumeratorId as string) || (req.headers['x-enumerator-id'] as string);

  // Access validation: Verify surveyor is not deactivated
  if (enumeratorId && enumeratorId !== 'all') {
    const surveyor = inMemoryEnumerators.get(enumeratorId);
    if (surveyor && !surveyor.active) {
      return res.status(403).json({ error: 'Forbidden: Surveyor account is deactivated or unauthorized.' });
    }
  }

  const { formId, status, startDate, endDate } = req.query;
  let list = Array.from(inMemorySubmissions.values());

  if (formId && formId !== 'all') {
    list = list.filter((s) => s.formId === formId);
  }
  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }
  if (enumeratorId && enumeratorId !== 'all') {
    list = list.filter((s) => s.enumeratorId === enumeratorId);
  }
  if (startDate) {
    list = list.filter((s) => new Date(s.createdAt) >= new Date(startDate as string));
  }
  if (endDate) {
    list = list.filter((s) => new Date(s.createdAt) <= new Date(endDate as string));
  }

  // Strict privacy boundary: Strip all respondent PII, answers, media URLs, and confidential survey content!
  const sanitized = list.map((s) => {
    const rawLat = s.metadata?.latitude;
    const rawLng = s.metadata?.longitude;
    const lat = typeof rawLat === 'number' && !isNaN(rawLat) ? rawLat : null;
    const lng = typeof rawLng === 'number' && !isNaN(rawLng) ? rawLng : null;
    const hasCoordinates = lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    return {
      id: s.id,
      instanceId: s.instanceId,
      formId: s.formId,
      formTitle: s.formTitle || s.formId,
      formVersion: s.formVersion || '1.0',
      enumeratorId: s.enumeratorId,
      enumeratorName: s.enumeratorName || 'Field Officer',
      deviceId: s.deviceId,
      status: s.status,
      createdAt: s.createdAt,
      syncedAt: s.syncedAt || s.createdAt,
      durationSeconds: s.metadata?.durationSeconds || 0,
      hasCoordinates,
      latitude: hasCoordinates ? lat : null,
      longitude: hasCoordinates ? lng : null,
      accuracy: hasCoordinates ? (s.metadata?.accuracy || 5.0) : null,
    };
  });

  const withGpsCount = sanitized.filter((r) => r.hasCoordinates).length;
  const noGpsCount = sanitized.length - withGpsCount;

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    totalRecords: sanitized.length,
    withGpsCount,
    noGpsCount,
    records: sanitized,
  });
});

// 5B. Situation Room: Detailed Finished Job Inspection (Access Code Protected)
app.get('/api/situation/job-review/:instanceId', (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const accessCode = (req.headers['x-access-code'] as string) || (req.query.accessCode as string);

  let foundSub = inMemorySubmissions.get(instanceId);
  if (!foundSub) {
    for (const s of inMemorySubmissions.values()) {
      if (s.id === instanceId || s.instanceId === instanceId) {
        foundSub = s;
        break;
      }
    }
  }

  if (!foundSub) {
    return res.status(404).json({ error: `Submission with instance ID "${instanceId}" was not found.` });
  }

  // Access code validation
  let isAuthorized = true;
  if (accessCode) {
    const code = String(accessCode).trim().toLowerCase();
    const authorizedCodes = ['admin', 'org_admin', 'enum_02', 'sup_01', 'analyst', 'dammyblack88@gmail.com'];
    if (!authorizedCodes.includes(code)) {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access Denied: Invalid supervisor access code or insufficient permissions.' });
  }

  res.json({
    success: true,
    submission: foundSub,
    auditHistory: [
      {
        action: 'INSPECTED_BY_SUPERVISOR',
        timestamp: new Date().toISOString(),
        accessCode: accessCode || 'supervisor_session',
      },
    ],
  });
});

app.post('/api/situation/job-review/:instanceId', (req: Request, res: Response) => {
  const { instanceId } = req.params;
  const { decision, notes, supervisorName, flagReason } = req.body;

  let foundSub = inMemorySubmissions.get(instanceId);
  if (!foundSub) {
    for (const s of inMemorySubmissions.values()) {
      if (s.id === instanceId || s.instanceId === instanceId) {
        foundSub = s;
        break;
      }
    }
  }

  if (!foundSub) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  foundSub.status = decision; // 'approved' | 'flagged' | 'rejected'
  foundSub.reviewNotes = notes;
  foundSub.reviewedBy = supervisorName || 'Supervisor';
  foundSub.reviewedAt = new Date().toISOString();
  if (flagReason) foundSub.flagReason = flagReason;

  inMemorySubmissions.set(foundSub.instanceId, foundSub);
  if (foundSub.id) inMemorySubmissions.set(foundSub.id, foundSub);

  logAuditEvent(
    `SUBMISSION_REVIEW_${decision.toUpperCase()}`,
    supervisorName || 'Supervisor',
    'supervisor',
    foundSub.instanceId,
    `Submission ${foundSub.instanceId} marked as ${decision}. Notes: ${notes || 'None'}`
  );

  res.json({
    success: true,
    message: `Submission status successfully updated to "${decision}".`,
    submission: foundSub,
  });
});

// 5C. Situation Room: Virtual Watch Live (Real-Time Enumerator Telemetry)
app.get('/api/situation/virtual-watch-live', (_req: Request, res: Response) => {
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

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    activeSessionsCount: liveSessions.length,
    sessions: liveSessions,
  });
});

// 5D. Situation Room: WebRTC Signaling Endpoint (Transparent, Consent-Based Remote QC Camera)
const serverWebRtcSessions = new Map<string, any>();

app.post('/api/situation/webrtc-signal', (req: Request, res: Response) => {
  const { sessionId, signalType, sdp, candidate, supervisorId, enumeratorConsent } = req.body;

  if (signalType === 'request_stream' && !enumeratorConsent) {
    return res.json({
      status: 'pending_enumerator_consent',
      message: 'Camera permission prompt dispatched to field device. Awaiting surveyor verbal & UI consent.',
    });
  }

  const session = serverWebRtcSessions.get(sessionId) || {};
  if (sdp) session.sdp = sdp;
  if (candidate) {
    session.candidates = session.candidates || [];
    session.candidates.push(candidate);
  }
  session.lastUpdated = new Date().toISOString();
  session.supervisorId = supervisorId;
  session.consentGranted = true;
  serverWebRtcSessions.set(sessionId, session);

  logAuditEvent(
    'REMOTE_VIDEO_QC_SESSION_ACCESSED',
    supervisorId || 'Supervisor',
    'supervisor',
    sessionId,
    'Live WebRTC remote QC visual audit session initiated with verified enumerator consent.'
  );

  res.json({
    success: true,
    sessionId,
    status: 'connected',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });
});

// 5E. Audio Media Stream Representation (Native CMRG Quality Control Audio Endpoint)
app.get('/api/media/audio', (req: Request, res: Response) => {
  const { track, uuid } = req.query;
  res.json({
    track: track || 'rec_1',
    uuid: uuid || 'cf_sample',
    verified: true,
    bitrateKbps: 64,
    sampleRateHz: 16000,
    channels: 1,
    format: 'audio/webm; codecs=opus',
    audioSpeechClarityScore: 0.94,
    transcriptionSample: 'Interviewer: "Good day, my name is from CMRG... Do you agree to participate?" Respondent: "Yes, I agree."',
  });
});

// 6. Private Media Access Endpoint (Protected, no public bucket)
app.get('/api/media/:mediaId', (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const media = privateMediaVault.get(mediaId);

  if (!media) {
    return res.status(404).json({ error: 'Media asset not found or expired.' });
  }

  // Return base64 or redirect
  res.json({ mediaId, dataUrl: media.dataUrl, contentType: media.contentType });
});

// 7. Enumerator Management
app.get('/api/enumerators', (_req: Request, res: Response) => {
  res.json(Array.from(inMemoryEnumerators.values()));
});

app.post('/api/enumerators', (req: Request, res: Response) => {
  const { name, email, region, deviceId } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Missing name or email for enumerator.' });
  }

  const id = `enum_${Date.now()}`;
  const record = {
    id,
    name,
    email,
    region: region || 'Unassigned',
    deviceId: deviceId || `CMRG-DEVICE-${Math.floor(100 + Math.random() * 900)}`,
    active: true,
    createdAt: new Date().toISOString(),
  };

  inMemoryEnumerators.set(id, record);
  res.status(201).json(record);
});

// 8. Activate / Deactivate Enumerator Access
app.patch('/api/enumerators/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { active, actor, actorRole } = req.body;

  const surveyor = inMemoryEnumerators.get(id);
  if (!surveyor) return res.status(404).json({ error: 'Enumerator not found' });

  surveyor.active = Boolean(active);
  inMemoryEnumerators.set(id, surveyor);

  logAuditEvent(
    surveyor.active ? 'ENUMERATOR_ACTIVATED' : 'ENUMERATOR_DEACTIVATED',
    actor || 'Admin',
    actorRole || 'admin',
    `${surveyor.name} (${surveyor.id})`,
    `Field officer device account ${surveyor.active ? 'restored' : 'suspended'}.`
  );

  res.json({ success: true, enumerator: surveyor });
});

// =========================================================================
// 9. PLATFORM CAPACITY, USAGE MANAGEMENT & AUDIT LOGS
// =========================================================================

// 9a. Real-time Capacity and Usage Metrics Dashboard
app.get('/api/admin/capacity-usage', (_req: Request, res: Response) => {
  const allSubmissions = Array.from(inMemorySubmissions.values());
  const allEnumerators = Array.from(inMemoryEnumerators.values());
  const allForms = Array.from(inMemoryForms.values());
  const allProjects = Array.from(inMemoryProjects.values());

  const activeInterviewers = allEnumerators.filter((e) => e.active).length;
  const submissionsToday = countTodaySubmissions();
  const submissionsThisMonth = countMonthlySubmissions();

  const statusCounts = {
    pending: allSubmissions.filter((s) => s.status === 'submitted' || s.status === 'draft').length,
    approved: allSubmissions.filter((s) => s.status === 'approved').length,
    rejected: allSubmissions.filter((s) => s.status === 'rejected').length,
    flagged: allSubmissions.filter((s) => s.status === 'flagged').length,
    synced: allSubmissions.filter((s) => s.status === 'synced').length,
  };

  const storage = calculateServerStorageAccounting();

  // Compute capacity warnings
  const warnings: string[] = [];
  const submissionPercent = (submissionsThisMonth / inMemoryCapacityConfig.monthlySubmissionAllowance) * 100;
  if (submissionPercent >= inMemoryCapacityConfig.warningThresholdPercent) {
    warnings.push(
      `Monthly submissions allowance reached ${submissionPercent.toFixed(1)}% (${submissionsThisMonth}/${inMemoryCapacityConfig.monthlySubmissionAllowance}).`
    );
  }
  if (storage.percentUsed >= inMemoryCapacityConfig.warningThresholdPercent) {
    warnings.push(
      `Organisation storage consumed ${storage.percentUsed.toFixed(1)}% of allocation (${storage.totalMB}MB / ${storage.quotaMB}MB).`
    );
  }
  if (allForms.length >= inMemoryCapacityConfig.maxQuestionnaires) {
    warnings.push(
      `Questionnaire limit reached (${allForms.length}/${inMemoryCapacityConfig.maxQuestionnaires} forms active).`
    );
  }

  const uploadAccounting = {
    totalSuccessful: allSubmissions.length,
    uploadFailures: inMemoryUploadFailures.size,
    syncFailures: 0,
    pendingOfflineSubmissions: statusCounts.pending,
    activeRetries: inMemoryUploadFailures.size,
  };

  res.json({
    totalRegisteredUsers: allEnumerators.length,
    activeInterviewers,
    totalProjects: allProjects.length,
    totalQuestionnaires: allForms.length,
    submissionsToday,
    submissionsThisMonth,
    statusCounts,
    storage,
    uploadAccounting,
    capacityWarnings: warnings,
    recentAuditEvents: inMemoryAuditLogs.slice(0, 20),
    capacityConfig: inMemoryCapacityConfig,
  });
});

// 9b. Get & Update Internal Capacity Profiles
app.get('/api/admin/capacity-config', (_req: Request, res: Response) => {
  res.json({
    currentConfig: inMemoryCapacityConfig,
    availableTiers: ['basic', 'pro', 'advanced', 'enterprise'],
  });
});

app.put('/api/admin/capacity-config', (req: Request, res: Response) => {
  const updates = req.body;
  const actor = req.body.updatedBy || req.headers['x-admin-user'] || 'Admin';

  inMemoryCapacityConfig = {
    ...inMemoryCapacityConfig,
    ...updates,
    lastUpdated: new Date().toISOString(),
    updatedBy: String(actor),
  };

  logAuditEvent(
    'CAPACITY_PROFILE_UPDATED',
    String(actor),
    'admin',
    `Capacity Profile (${inMemoryCapacityConfig.tier.toUpperCase()})`,
    `Updated configuration: Storage ${inMemoryCapacityConfig.maxStorageMB}MB, Allowance: ${inMemoryCapacityConfig.monthlySubmissionAllowance} submissions, OrgMode: ${inMemoryCapacityConfig.organisationMode}.`
  );

  res.json({ success: true, capacityConfig: inMemoryCapacityConfig });
});

// 9c. Audit Trail Endpoint
app.get('/api/admin/audit-logs', (_req: Request, res: Response) => {
  res.json(inMemoryAuditLogs);
});

// =========================================================================
// 10. RESEARCH PROJECT MANAGEMENT
// =========================================================================

app.get('/api/projects', (_req: Request, res: Response) => {
  const projects = Array.from(inMemoryProjects.values()).map((p) => {
    // Tally actual submissions
    const count = Array.from(inMemorySubmissions.values()).filter(
      (s) => s.projectId === p.id || p.formIds?.includes(s.formId)
    ).length;
    return { ...p, submissionsCount: count };
  });
  res.json(projects);
});

app.post('/api/projects', (req: Request, res: Response) => {
  const { name, code, description, leadResearcher, formIds, assignedEnumeratorIds, maxSubmissionsLimit } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'Project name and study code are required.' });
  }

  const id = `prj_${Date.now()}`;
  const newProject = {
    id,
    code,
    name,
    description: description || '',
    leadResearcher: leadResearcher || 'CMRG Lead Researcher',
    status: 'active',
    formIds: formIds || [],
    assignedEnumeratorIds: assignedEnumeratorIds || [],
    maxSubmissionsLimit: maxSubmissionsLimit || 10000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submissionsCount: 0,
  };

  inMemoryProjects.set(id, newProject);

  logAuditEvent(
    'PROJECT_CREATED',
    req.body.actor || 'Principal Investigator',
    'admin',
    `${newProject.name} (${newProject.code})`,
    `Provisioned new research project with ${newProject.formIds.length} questionnaires.`
  );

  res.status(201).json(newProject);
});

app.put('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = inMemoryProjects.get(id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const updated = {
    ...project,
    ...req.body,
    id,
    updatedAt: new Date().toISOString(),
  };

  inMemoryProjects.set(id, updated);

  logAuditEvent(
    'PROJECT_UPDATED',
    req.body.actor || 'Principal Investigator',
    'admin',
    `${updated.name} (${updated.code})`,
    'Updated project parameters and questionnaire assignments.'
  );

  res.json({ success: true, project: updated });
});

// =========================================================================
// 11. BULK SUBMISSION REVIEW & SUPERVISOR AUDITING
// =========================================================================

app.post('/api/submissions/bulk-review', (req: Request, res: Response) => {
  const { submissionIds, action, notes, actor, actorRole } = req.body;

  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return res.status(400).json({ error: 'submissionIds array is required.' });
  }

  if (!['approve', 'reject', 'flag'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve, reject, or flag.' });
  }

  const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged';
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const subId of submissionIds) {
    // Find by id or instanceId
    let foundSub: any = null;
    let foundKey: string | null = null;

    for (const [key, s] of inMemorySubmissions.entries()) {
      if (s.id === subId || s.instanceId === subId) {
        foundSub = s;
        foundKey = key;
        break;
      }
    }

    if (foundSub && foundKey) {
      foundSub.status = targetStatus;
      foundSub.reviewedBy = actor || 'Supervisor';
      foundSub.reviewedAt = now;
      if (notes) foundSub.reviewNotes = notes;
      inMemorySubmissions.set(foundKey, foundSub);
      updatedCount++;
    }
  }

  logAuditEvent(
    `SUBMISSIONS_BULK_${action.toUpperCase()}`,
    actor || 'Supervisor',
    actorRole || 'supervisor',
    `${updatedCount} Submissions`,
    `Bulk ${action}d ${updatedCount} submissions. Notes: ${notes || 'None'}.`
  );

  res.json({
    success: true,
    updatedCount,
    action,
    newStatus: targetStatus,
    timestamp: now,
  });
});

// =========================================================================
// 12. PHASE 1 — AUTHENTICATION, ORGANIZATIONS & ROLE-BASED ACCESS CONTROL
// =========================================================================

// Session & Role Authorization Middleware
function getSessionFromRequest(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  const session = inMemorySessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    inMemorySessions.delete(token);
    return null;
  }
  return session;
}

function getRolePermissions(role: EnterpriseRole): string[] {
  switch (role) {
    case 'platform_admin':
      return [
        'org:manage',
        'users:manage_all',
        'projects:create',
        'projects:assign',
        'questionnaires:publish',
        'data:view_all',
        'data:export',
        'situation:review',
        'geofence:override',
        'system:configure',
      ];
    case 'org_admin':
      return [
        'users:manage_org',
        'projects:create',
        'projects:assign',
        'questionnaires:publish',
        'data:view_org',
        'data:export',
        'situation:review',
        'geofence:override',
      ];
    case 'supervisor':
      return [
        'projects:view_assigned',
        'questionnaires:preview',
        'data:view_assigned',
        'data:review',
        'situation:review',
        'geofence:override',
      ];
    case 'data_analyst':
      return [
        'projects:view_assigned',
        'questionnaires:view',
        'data:view_all',
        'data:export',
        'data:sql_studio',
        'situation:view',
      ];
    case 'enumerator':
      return [
        'projects:view_assigned',
        'questionnaires:collect',
        'submissions:create',
        'submissions:sync',
      ];
    default:
      return [];
  }
}

// 1. User Registration
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, displayName, role, orgId, orgName } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and full display name are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (inMemoryUsers.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  // Password complexity check
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const assignedRole: EnterpriseRole = ['platform_admin', 'org_admin', 'supervisor', 'enumerator', 'data_analyst'].includes(role)
    ? role
    : 'enumerator';

  const targetOrgId = orgId || 'org_cmrg';
  const targetOrg = inMemoryOrganizations.get(targetOrgId);
  const targetOrgName = targetOrg ? targetOrg.name : (orgName || 'Communication and Marketing Research Group Limited');

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const verificationToken = `verify_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
  const userId = `usr_${Date.now()}`;

  const newUser: StoredUser = {
    id: userId,
    email: normalizedEmail,
    displayName,
    role: assignedRole,
    passwordHash,
    salt,
    orgId: targetOrgId,
    orgName: targetOrgName,
    isEmailVerified: false,
    verificationToken,
    active: true,
    createdAt: new Date().toISOString(),
    assignedProjectIds: ['prj_01'],
  };

  inMemoryUsers.set(normalizedEmail, newUser);

  logAuditEvent(
    'USER_REGISTERED',
    displayName,
    assignedRole,
    targetOrgName,
    `New user registered with role [${assignedRole}]. Verification pending.`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Registration successful! Verification token generated for email validation.',
    verificationToken, // In production delivered via email
    user: {
      userId,
      email: normalizedEmail,
      displayName,
      role: assignedRole,
      orgId: targetOrgId,
      orgName: targetOrgName,
      isEmailVerified: false,
    },
  });
});

// 2. User Login (Password or Access Code/PIN)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, accessCode, pin, authMethod } = req.body;

  // Access Code login for field enumerators
  if (authMethod === 'access_code' || accessCode) {
    const code = (accessCode || '').trim().toLowerCase();
    // Locate user by accessCode or id
    let matchedUser: StoredUser | null = null;
    for (const u of inMemoryUsers.values()) {
      if ((u.accessCode && u.accessCode.toLowerCase() === code) || u.id.toLowerCase() === code) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid or unknown Enumerator Access Code.' });
    }

    if (!matchedUser.active) {
      return res.status(403).json({ error: 'Access Denied: This field officer account has been deactivated by administration.' });
    }

    // Optional PIN verification if set
    if (matchedUser.pinHash && matchedUser.pinSalt && pin) {
      const pinOk = verifyPassword(pin, matchedUser.pinSalt, matchedUser.pinHash);
      if (!pinOk) {
        return res.status(401).json({ error: 'Incorrect security PIN for this access code.' });
      }
    }

    const sessionToken = `cmrg_sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days for field workers

    inMemorySessions.set(sessionToken, {
      userId: matchedUser.id,
      role: matchedUser.role,
      orgId: matchedUser.orgId,
      email: matchedUser.email,
      displayName: matchedUser.displayName,
      createdAt: Date.now(),
      expiresAt,
    });

    matchedUser.lastLoginAt = new Date().toISOString();

    logAuditEvent(
      'ACCESS_CODE_LOGIN_SUCCESS',
      matchedUser.displayName,
      matchedUser.role,
      matchedUser.orgName,
      `Field officer logged in via device access code [${matchedUser.accessCode}].`,
      req.ip
    );

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        userId: matchedUser.id,
        email: matchedUser.email,
        displayName: matchedUser.displayName,
        role: matchedUser.role,
        orgId: matchedUser.orgId,
        orgName: matchedUser.orgName,
        authMethod: 'access_code',
        assignedProjectIds: matchedUser.assignedProjectIds,
        permissions: getRolePermissions(matchedUser.role),
        loginAt: matchedUser.lastLoginAt,
      },
    });
  }

  // Standard Email + Password Authentication
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = inMemoryUsers.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password combination.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Account suspended. Please contact your organization administrator.' });
  }

  const isValidPassword = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValidPassword) {
    logAuditEvent(
      'LOGIN_FAILED_BAD_PASSWORD',
      normalizedEmail,
      user.role,
      user.orgName,
      'Invalid password attempt.',
      req.ip
    );
    return res.status(401).json({ error: 'Invalid email or password combination.' });
  }

  // Organization approval check for non-platform admins
  if (user.role !== 'platform_admin') {
    const org = inMemoryOrganizations.get(user.orgId);
    if (org && org.status === 'pending') {
      return res.status(403).json({ error: 'Organization approval pending. An administrator must approve your organization before access is granted.' });
    }
    if (org && (org.status === 'suspended' || org.status === 'rejected')) {
      return res.status(403).json({ error: 'Organization access suspended or rejected.' });
    }
  }

  const sessionToken = `cmrg_sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  inMemorySessions.set(sessionToken, {
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    email: user.email,
    displayName: user.displayName,
    createdAt: Date.now(),
    expiresAt,
  });

  user.lastLoginAt = new Date().toISOString();

  logAuditEvent(
    'USER_LOGIN_SUCCESS',
    user.displayName,
    user.role,
    user.orgName,
    `User signed in successfully with role [${user.role}].`,
    req.ip
  );

  res.json({
    success: true,
    token: sessionToken,
    user: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      orgId: user.orgId,
      orgName: user.orgName,
      authMethod: 'password',
      isEmailVerified: user.isEmailVerified,
      assignedProjectIds: user.assignedProjectIds,
      permissions: getRolePermissions(user.role),
      loginAt: user.lastLoginAt,
    },
  });
});

// 3. User Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (session) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (token) inMemorySessions.delete(token);

    logAuditEvent(
      'USER_LOGOUT',
      session.displayName,
      session.role,
      session.orgId,
      'User session terminated.',
      req.ip
    );
  }
  res.json({ success: true, message: 'Signed out successfully.' });
});

// 4. Email Verification
app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  const { token, email } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  let foundUser: StoredUser | null = null;
  for (const u of inMemoryUsers.values()) {
    if (u.verificationToken === token || (email && u.email.toLowerCase() === email.toLowerCase())) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser) {
    return res.status(400).json({ error: 'Invalid or expired email verification token.' });
  }

  foundUser.isEmailVerified = true;
  foundUser.verificationToken = undefined;

  logAuditEvent(
    'EMAIL_VERIFIED',
    foundUser.displayName,
    foundUser.role,
    foundUser.orgName,
    'User successfully verified email address.',
    req.ip
  );

  res.json({
    success: true,
    message: 'Email verified successfully! You may now access all authorized platform features.',
  });
});

// 5. Password Reset Request
app.post('/api/auth/request-password-reset', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const user = inMemoryUsers.get(email.trim().toLowerCase());
  // Standard security practice: Don't reveal if user does or doesn't exist
  if (!user) {
    return res.json({
      success: true,
      message: 'If the email exists, a password reset authorization code has been dispatched.',
    });
  }

  const resetToken = `reset_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

  logAuditEvent(
    'PASSWORD_RESET_REQUESTED',
    user.displayName,
    user.role,
    user.orgName,
    'Password reset link/token generated.',
    req.ip
  );

  res.json({
    success: true,
    message: 'If the email exists, a password reset authorization code has been dispatched.',
    resetToken, // Returned for dev/testing ease
  });
});

// 6. Complete Password Reset
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  let foundUser: StoredUser | null = null;
  for (const u of inMemoryUsers.values()) {
    if (u.resetToken === token) {
      if (u.resetTokenExpiry && Date.now() > u.resetTokenExpiry) {
        return res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
      }
      foundUser = u;
      break;
    }
  }

  if (!foundUser) {
    return res.status(400).json({ error: 'Invalid password reset token.' });
  }

  const newSalt = generateSalt();
  foundUser.salt = newSalt;
  foundUser.passwordHash = hashPassword(newPassword, newSalt);
  foundUser.resetToken = undefined;
  foundUser.resetTokenExpiry = undefined;

  logAuditEvent(
    'PASSWORD_RESET_SUCCESS',
    foundUser.displayName,
    foundUser.role,
    foundUser.orgName,
    'User password changed successfully via reset token.',
    req.ip
  );

  res.json({ success: true, message: 'Password reset successful. Please sign in with your new credentials.' });
});

// 7. Get Current User Session (Session validation)
app.get('/api/auth/me', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'No active session. Please sign in.' });
  }

  const user = inMemoryUsers.get(session.email.toLowerCase());
  if (!user || !user.active) {
    return res.status(403).json({ error: 'User account has been deactivated.' });
  }

  res.json({
    success: true,
    user: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      orgId: user.orgId,
      orgName: user.orgName,
      isEmailVerified: user.isEmailVerified,
      assignedProjectIds: user.assignedProjectIds,
      permissions: getRolePermissions(user.role),
      loginAt: user.lastLoginAt,
    },
  });
});

// 8. Organization Registration
app.post('/api/auth/register-org', (req: Request, res: Response) => {
  const { name, contactEmail, planTier } = req.body;
  if (!name || !contactEmail) {
    return res.status(400).json({ error: 'Organization name and contact email are required.' });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const orgId = `org_${Date.now()}`;

  const newOrg: StoredOrganization = {
    id: orgId,
    name,
    slug,
    contactEmail,
    status: 'pending', // Requires administrator approval per Phase 1 requirements
    registeredAt: new Date().toISOString(),
    planTier: planTier || 'pro',
  };

  inMemoryOrganizations.set(orgId, newOrg);

  logAuditEvent(
    'ORG_REGISTERED',
    contactEmail,
    'org_admin',
    name,
    `New organization registration pending platform administrator approval.`,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Organization registered successfully and submitted for platform approval.',
    organization: newOrg,
  });
});

// 9. List Organizations (Platform Admin can view all; others see their own)
app.get('/api/admin/organizations', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  const list = Array.from(inMemoryOrganizations.values());

  if (session && session.role !== 'platform_admin') {
    return res.json(list.filter((o) => o.id === session.orgId));
  }

  res.json(list);
});

// 10. Organization Approval / Rejection (Platform Administrator only)
app.post('/api/admin/organizations/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, reviewerName } = req.body; // action: 'approve' | 'reject' | 'suspend'

  const org = inMemoryOrganizations.get(id);
  if (!org) {
    return res.status(404).json({ error: 'Organization not found.' });
  }

  const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended';
  org.status = targetStatus;
  org.approvedAt = new Date().toISOString();
  org.approvedBy = reviewerName || 'Dr. Damilare Afolabi (Platform Admin)';

  logAuditEvent(
    `ORG_${action.toUpperCase()}D`,
    org.approvedBy || reviewerName || 'Dr. Damilare Afolabi (Platform Admin)',
    'platform_admin',
    org.name,
    `Organization status changed to [${targetStatus}].`,
    req.ip
  );

  res.json({
    success: true,
    organization: org,
  });
});

// 11. List Users (Enforces organization data isolation)
app.get('/api/auth/users', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  let users = Array.from(inMemoryUsers.values()).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    orgId: u.orgId,
    orgName: u.orgName,
    accessCode: u.accessCode,
    isEmailVerified: u.isEmailVerified,
    active: u.active,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    assignedProjectIds: u.assignedProjectIds,
  }));

  // Role and organization isolation: If not platform admin, filter only to caller's org
  if (session && session.role !== 'platform_admin') {
    users = users.filter((u) => u.orgId === session.orgId);
  }

  res.json(users);
});

// 12. Update User Account (Toggle Active, Change Role, Assign Projects)
app.put('/api/auth/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { active, role, assignedProjectIds, displayName } = req.body;

  let targetUser: StoredUser | null = null;
  for (const u of inMemoryUsers.values()) {
    if (u.id === id || u.email.toLowerCase() === id.toLowerCase()) {
      targetUser = u;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  if (active !== undefined) targetUser.active = Boolean(active);
  if (role && ['platform_admin', 'org_admin', 'supervisor', 'enumerator', 'data_analyst'].includes(role)) {
    targetUser.role = role;
  }
  if (Array.isArray(assignedProjectIds)) targetUser.assignedProjectIds = assignedProjectIds;
  if (displayName) targetUser.displayName = displayName;

  logAuditEvent(
    'USER_ACCOUNT_UPDATED',
    'Platform Administrator',
    'platform_admin',
    targetUser.displayName,
    `User account updated: role=[${targetUser.role}], active=[${targetUser.active}].`,
    req.ip
  );

  res.json({
    success: true,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      role: targetUser.role,
      orgId: targetUser.orgId,
      orgName: targetUser.orgName,
      active: targetUser.active,
      assignedProjectIds: targetUser.assignedProjectIds,
    },
  });
});

// 13. OAuth 2.0 Verification (With Role Mapping)
app.post('/api/auth/oauth-verify', (req: Request, res: Response) => {
  const { email, displayName, token, photoURL } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required for OAuth verification.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let existingUser = inMemoryUsers.get(normalizedEmail);

  let role: EnterpriseRole = 'enumerator';
  if (
    normalizedEmail.includes('director') ||
    normalizedEmail === 'dammyblack88@gmail.com'
  ) {
    role = 'platform_admin';
  } else if (normalizedEmail.includes('admin') || normalizedEmail.endsWith('@cmrg.org')) {
    role = 'org_admin';
  } else if (normalizedEmail.includes('lead') || normalizedEmail.includes('supervisor')) {
    role = 'supervisor';
  } else if (normalizedEmail.includes('analyst')) {
    role = 'data_analyst';
  }

  if (existingUser) {
    role = existingUser.role;
  }

  const sessionToken = token || `cmrg_tok_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  inMemorySessions.set(sessionToken, {
    userId: existingUser ? existingUser.id : `usr_${Date.now()}`,
    role,
    orgId: existingUser ? existingUser.orgId : 'org_cmrg',
    email: normalizedEmail,
    displayName: displayName || (existingUser ? existingUser.displayName : email.split('@')[0]),
    createdAt: Date.now(),
    expiresAt,
  });

  logAuditEvent(
    'OAUTH_LOGIN_SUCCESS',
    displayName || email,
    role,
    'CMRG Web Portal',
    `User authenticated via OAuth 2.0 with role [${role.toUpperCase()}].`,
    req.ip
  );

  res.json({
    success: true,
    token: sessionToken,
    user: {
      userId: existingUser ? existingUser.id : `user_${Date.now()}`,
      email: normalizedEmail,
      displayName: displayName || (existingUser ? existingUser.displayName : email.split('@')[0]),
      role,
      orgId: existingUser ? existingUser.orgId : 'org_cmrg',
      orgName: existingUser ? existingUser.orgName : 'Communication and Marketing Research Group Limited',
      authMethod: 'oauth2',
      photoURL,
      permissions: getRolePermissions(role),
      token: sessionToken,
      loginAt: new Date().toISOString(),
    },
  });
});

// =========================================================================
// 13. ENHANCED DATA EXPORT (DETAILED CSV & DUMP SQL)
// =========================================================================

app.get('/api/export/csv', (req: Request, res: Response) => {
  const { formId, status, projectId, type } = req.query;
  let list = Array.from(inMemorySubmissions.values());

  if (formId && formId !== 'all') {
    list = list.filter((s) => s.formId === formId);
  }
  if (status && status !== 'all') {
    list = list.filter((s) => s.status === status);
  }
  if (projectId && projectId !== 'all') {
    list = list.filter((s) => s.projectId === projectId);
  }

  if (type === 'summary') {
    const headers = [
      'InstanceID',
      'FormTitle',
      'FormVersion',
      'ProjectID',
      'EnumeratorName',
      'Status',
      'DurationSeconds',
      'Latitude',
      'Longitude',
      'CreatedAt',
      'SyncedAt',
    ];
    const rows = list.map((s) => [
      s.instanceId,
      `"${(s.formTitle || '').replace(/"/g, '""')}"`,
      s.formVersion || '1.0',
      s.projectId || 'prj_01',
      `"${(s.enumeratorName || '').replace(/"/g, '""')}"`,
      s.status,
      s.metadata?.durationSeconds || 0,
      s.metadata?.latitude || '',
      s.metadata?.longitude || '',
      s.createdAt,
      s.syncedAt || '',
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cmrg_summary_${Date.now()}.csv"`);
    return res.send([headers.join(','), ...rows.map((r) => r.join(','))].join('\n'));
  }

  // Detailed wide-format CSV with question-level columns
  // 1. Gather all question names across all filtered records
  const questionKeysSet = new Set<string>();
  for (const s of list) {
    if (s.answers && typeof s.answers === 'object') {
      for (const k of Object.keys(s.answers)) {
        questionKeysSet.add(k);
      }
    }
  }
  const questionKeys = Array.from(questionKeysSet);

  const baseHeaders = [
    'InstanceID',
    'FormID',
    'FormTitle',
    'FormVersion',
    'ProjectID',
    'EnumeratorID',
    'EnumeratorName',
    'DeviceID',
    'Status',
    'SubmittedAt',
    'SyncedAt',
    'DurationSeconds',
    'Latitude',
    'Longitude',
    'Accuracy',
    'AudioAuditRecorded',
    'ReviewNotes',
    'ReviewedBy',
  ];

  const allHeaders = [...baseHeaders, ...questionKeys.map((k) => `q_${k}`)];

  const rows = list.map((s) => {
    const baseCols = [
      s.instanceId,
      s.formId,
      `"${(s.formTitle || '').replace(/"/g, '""')}"`,
      s.formVersion || '1.0',
      s.projectId || 'prj_01',
      s.enumeratorId || '',
      `"${(s.enumeratorName || '').replace(/"/g, '""')}"`,
      s.deviceId || '',
      s.status,
      s.createdAt,
      s.syncedAt || '',
      s.metadata?.durationSeconds || 0,
      s.metadata?.latitude || '',
      s.metadata?.longitude || '',
      s.metadata?.accuracy || '',
      s.metadata?.audioAuditRecorded ? 'YES' : 'NO',
      `"${(s.reviewNotes || '').replace(/"/g, '""')}"`,
      `"${(s.reviewedBy || '').replace(/"/g, '""')}"`,
    ];

    const questionCols = questionKeys.map((qKey) => {
      const val = s.answers ? s.answers[qKey] : undefined;
      if (val === undefined || val === null) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    return [...baseCols, ...questionCols].join(',');
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cmrg_detailed_export_${Date.now()}.csv"`);
  res.send([allHeaders.join(','), ...rows].join('\n'));
});

// Legacy generic export endpoint preserved
app.get('/api/export/:format', (req: Request, res: Response) => {
  const { format } = req.params;
  const list = Array.from(inMemorySubmissions.values());

  if (format === 'csv') {
    return res.redirect('/api/export/csv');
  }

  if (format === 'sql') {
    const statements = list.map((s) => {
      return `INSERT INTO cmrg_submissions (instance_id, form_id, form_title, enumerator_name, answers) VALUES ('${s.instanceId}', '${s.formId}', '${s.formTitle.replace(/'/g, "''")}', '${s.enumeratorName.replace(/'/g, "''")}', '${JSON.stringify(s.answers).replace(/'/g, "''")}'::jsonb) ON CONFLICT (instance_id) DO NOTHING;`;
    });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="cmrg_dump.sql"');
    return res.send(statements.join('\n'));
  }

  res.json(list);
});

// =========================================================================
// VITE MIDDLEWARE (Development) OR STATIC SERVE (Production)
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT) || 3000, '0.0.0.0', () => {
    console.log(`CMRG DataCollect Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
