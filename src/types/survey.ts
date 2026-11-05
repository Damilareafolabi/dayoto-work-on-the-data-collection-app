export type QuestionType =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'select_one'
  | 'select_multiple'
  | 'geopoint'
  | 'image'
  | 'audio'
  | 'signature'
  | 'barcode'
  | 'date'
  | 'time'
  | 'note';

export interface ChoiceOption {
  value: string;
  label: string;
  score?: number;
}

export interface QuestionDefinition {
  id: string;
  name: string;
  type: QuestionType;
  label: string;
  hint?: string;
  required?: boolean;
  options?: ChoiceOption[];
  constraint?: string;
  constraintMessage?: string;
  relevant?: string; // skip logic expression e.g. "age >= 18" or "drinks_soda === 'yes'"
  appearance?: string; // e.g. "compact", "horizontal", "multiline"
  defaultValue?: any;
}

export interface FormDefinition {
  id: string;
  formId: string;
  projectId?: string;
  title: string;
  version: string;
  description: string;
  category: string;
  questions: QuestionDefinition[];
  isEncrypted: boolean;
  publicKey?: string;
  active: boolean;
  status?: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  submissionsCount?: number;
  assignedEnumeratorIds?: string[];
  assignedRegions?: string[];
}

export interface EncryptedEnvelope {
  algorithm: 'AES-GCM-256';
  iv: string;
  ciphertext: string;
  encryptedKey: string;
  keyFingerprint: string;
  timestamp: string;
}

export interface SubmissionMetadata {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  audioAuditRecorded?: boolean;
  audioAuditDurationSeconds?: number;
  deviceBatteryLevel?: number;
  appVersion: string;
  deviceId: string;
  networkAtSubmission: 'online' | 'offline';
}

export interface Submission {
  id: string;
  instanceId: string;
  projectId?: string;
  formId: string;
  formTitle: string;
  formVersion: string;
  enumeratorId: string;
  enumeratorName: string;
  supervisorName?: string;
  deviceId: string;
  status: 'draft' | 'submitted' | 'synced' | 'flagged' | 'approved' | 'rejected';
  answers: Record<string, any>;
  encryptedEnvelope?: EncryptedEnvelope;
  metadata: SubmissionMetadata;
  audios?: {
    rec_1?: string;
    rec_2?: string;
    rec_3?: string;
  };
  photos?: string[];
  locationState?: string;
  sector?: string;
  lsmScore?: number;
  lsmTier?: string;
  createdAt: string;
  syncedAt?: string;
  flagReason?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ProjectDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  leadResearcher: string;
  status: 'active' | 'archived' | 'paused';
  formIds: string[];
  assignedEnumeratorIds: string[];
  maxSubmissionsLimit?: number;
  createdAt: string;
  updatedAt: string;
  submissionsCount?: number;
}

export type CapacityProfileTier = 'basic' | 'pro' | 'advanced' | 'enterprise';

export interface CapacityConfig {
  tier: CapacityProfileTier;
  profileName: string;
  maxStorageMB: number;
  monthlySubmissionAllowance: number;
  maxQuestionnaires: number;
  maxActiveEnumerators: number;
  allowOfflineCollection: boolean;
  allowCsvExport: boolean;
  allowSqlExport: boolean;
  allowFirebaseCloudSync: boolean;
  allowAiAssistance: boolean;
  monthlyAiTokenAllowance: number;
  organisationMode: boolean;
  organisationName: string;
  enforceHardLimits: boolean;
  warningThresholdPercent: number; // e.g. 80
  supportTier: 'Standard Community' | 'Field Operational Support' | 'Dedicated CMRG Specialist' | '24/7 Mission Critical';
  projectSpecificRestrictions: boolean;
  lastUpdated: string;
  updatedBy: string;
}

export interface StorageAccounting {
  totalBytes: number;
  totalMB: number;
  photosBytes: number;
  photosCount: number;
  audioBytes: number;
  audioCount: number;
  signaturesBytes: number;
  signaturesCount: number;
  submissionsJsonBytes: number;
  submissionsCount: number;
  remainingMB: number;
  quotaMB: number;
  percentUsed: number;
}

export interface UploadFailureRecord {
  id: string;
  instanceId: string;
  formId: string;
  enumeratorId: string;
  errorCode: string;
  errorMessage: string;
  attemptCount: number;
  timestamp: string;
  status: 'pending_retry' | 'failed' | 'resolved';
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  actorRole: EnterpriseUserRole | 'system';
  target: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface PlatformCapacityMetrics {
  totalRegisteredUsers: number;
  activeInterviewers: number;
  totalProjects: number;
  totalQuestionnaires: number;
  submissionsToday: number;
  submissionsThisMonth: number;
  statusCounts: {
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
    synced: number;
  };
  storage: StorageAccounting;
  uploadAccounting: {
    totalSuccessful: number;
    uploadFailures: number;
    syncFailures: number;
    pendingOfflineSubmissions: number;
    activeRetries: number;
  };
  capacityWarnings: string[];
  recentAuditEvents: AuditEvent[];
  capacityConfig: CapacityConfig;
}

export type EnterpriseUserRole =
  | 'platform_admin'
  | 'org_admin'
  | 'supervisor'
  | 'enumerator'
  | 'data_analyst'
  | 'admin'; // backwards-compatible alias for platform_admin

export interface Organization {
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

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  role: EnterpriseUserRole;
  orgId: string;
  orgName?: string;
  isEmailVerified: boolean;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserAuthSession {
  userId: string;
  email: string;
  displayName: string;
  role: EnterpriseUserRole;
  orgId?: string;
  orgName?: string;
  authMethod: 'password' | 'oauth2' | 'access_code' | 'firebase';
  token?: string;
  photoURL?: string;
  loginAt: string;
  assignedProjectIds?: string[];
  assignedRegions?: string[];
  permissions?: string[];
}

export interface EnumeratorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  deviceId: string;
  active: boolean;
  totalSubmissions: number;
  lastActiveAt: string;
  currentLat?: number;
  currentLng?: number;
  batteryLevel?: number;
  assignedProjectIds?: string[];
}

export interface SituationAlert {
  id: string;
  type: 'speed_audit' | 'geofence' | 'duplicate_gps' | 'audio_missing' | 'battery_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enumeratorName: string;
  formTitle: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  lat?: number;
  lng?: number;
}

export interface ODKSettingsConfig {
  serverUrl: string;
  username: string;
  serverType: 'CMRG Cloud' | 'PostgreSQL Standalone' | 'Central Hub';
  autoSync: boolean;
  autoSyncIntervalMinutes: number;
  deviceId: string;
  enumeratorName: string;
  enumeratorRegion: string;
  requireEncryption: boolean;
  offlineStorageQuotaMB: number;
  audioAuditingEnabled: boolean;
}

