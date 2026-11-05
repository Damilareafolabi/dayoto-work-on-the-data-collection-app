import { FormDefinition, Submission, EnumeratorProfile, SituationAlert, ODKSettingsConfig } from '../types/survey.ts';
import {
  INITIAL_FORMS,
  INITIAL_SUBMISSIONS,
  INITIAL_ENUMERATORS,
  INITIAL_SITUATION_ALERTS,
  DEFAULT_SETTINGS,
  INITIAL_PROJECTS,
  INITIAL_CAPACITY_CONFIG,
} from './mockData.ts';

const STORAGE_KEYS = {
  FORMS: 'cmrg_forms_v1',
  SUBMISSIONS: 'cmrg_submissions_v1',
  ENUMERATORS: 'cmrg_enumerators_v1',
  ALERTS: 'cmrg_alerts_v1',
  SETTINGS: 'cmrg_settings_v1',
};

export class StorageManager {
  static getForms(): FormDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FORMS);
      return data ? JSON.parse(data) : INITIAL_FORMS;
    } catch {
      return INITIAL_FORMS;
    }
  }

  static saveForms(forms: FormDefinition[]): void {
    localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(forms));
  }

  static getSubmissions(): Submission[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      return data ? JSON.parse(data) : INITIAL_SUBMISSIONS;
    } catch {
      return INITIAL_SUBMISSIONS;
    }
  }

  static saveSubmissions(submissions: Submission[]): void {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  }

  static addSubmission(submission: Submission): void {
    const list = this.getSubmissions();
    const existingIdx = list.findIndex((s) => s.id === submission.id || s.instanceId === submission.instanceId);
    if (existingIdx >= 0) {
      list[existingIdx] = submission;
    } else {
      list.unshift(submission);
    }
    this.saveSubmissions(list);
  }

  static getEnumerators(): EnumeratorProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ENUMERATORS);
      return data ? JSON.parse(data) : INITIAL_ENUMERATORS;
    } catch {
      return INITIAL_ENUMERATORS;
    }
  }

  static saveEnumerators(enumerators: EnumeratorProfile[]): void {
    localStorage.setItem(STORAGE_KEYS.ENUMERATORS, JSON.stringify(enumerators));
  }

  static getAlerts(): SituationAlert[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
      return data ? JSON.parse(data) : INITIAL_SITUATION_ALERTS;
    } catch {
      return INITIAL_SITUATION_ALERTS;
    }
  }

  static saveAlerts(alerts: SituationAlert[]): void {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  }

  static getSettings(): ODKSettingsConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: ODKSettingsConfig): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  static getProjects(): import('../types/survey.ts').ProjectDefinition[] {
    try {
      const data = localStorage.getItem('cmrg_projects_v1');
      return data ? JSON.parse(data) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  }

  static getProjectsSync(): import('../types/survey.ts').ProjectDefinition[] {
    return this.getProjects();
  }

  static saveProjects(projects: import('../types/survey.ts').ProjectDefinition[]): void {
    localStorage.setItem('cmrg_projects_v1', JSON.stringify(projects));
  }

  static getCapacityConfig(): import('../types/survey.ts').CapacityConfig {
    try {
      const data = localStorage.getItem('cmrg_capacity_config_v1');
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return INITIAL_CAPACITY_CONFIG;
  }

  static saveCapacityConfig(config: import('../types/survey.ts').CapacityConfig): void {
    localStorage.setItem('cmrg_capacity_config_v1', JSON.stringify(config));
  }

  static getAuditLogs(): import('../types/survey.ts').AuditEvent[] {
    try {
      const data = localStorage.getItem('cmrg_audit_logs_v1');
      if (data) return JSON.parse(data);
    } catch {}
    return [
      {
        id: 'audit_01',
        action: 'CAPACITY_PROFILE_LOADED',
        actor: 'CMRG Research Director',
        actorRole: 'admin',
        target: 'Platform Capacity Engine',
        details: 'Initial operational capacity configuration verified for 2026 fieldwork season.',
        timestamp: new Date().toISOString(),
      },
    ];
  }

  static addAuditEvent(event: Omit<import('../types/survey.ts').AuditEvent, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newEntry: import('../types/survey.ts').AuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    if (logs.length > 200) logs.length = 200; // retain last 200 audit events
    localStorage.setItem('cmrg_audit_logs_v1', JSON.stringify(logs));
  }

  static getUploadFailures(): import('../types/survey.ts').UploadFailureRecord[] {
    try {
      const data = localStorage.getItem('cmrg_upload_failures_v1');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static recordUploadFailure(record: Omit<import('../types/survey.ts').UploadFailureRecord, 'id' | 'timestamp'>): void {
    const list = this.getUploadFailures();
    const existingIdx = list.findIndex((f) => f.instanceId === record.instanceId);
    if (existingIdx >= 0) {
      list[existingIdx].attemptCount += 1;
      list[existingIdx].errorMessage = record.errorMessage;
      list[existingIdx].timestamp = new Date().toISOString();
    } else {
      list.unshift({
        ...record,
        id: `fail_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
    localStorage.setItem('cmrg_upload_failures_v1', JSON.stringify(list));
  }

  static clearUploadFailure(instanceId: string): void {
    const list = this.getUploadFailures().filter((f) => f.instanceId !== instanceId);
    localStorage.setItem('cmrg_upload_failures_v1', JSON.stringify(list));
  }

  static getAuthSession(): import('../types/survey.ts').UserAuthSession | null {
    try {
      const data = localStorage.getItem('cmrg_auth_session_v1');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static saveAuthSession(session: import('../types/survey.ts').UserAuthSession | null): void {
    if (session) {
      localStorage.setItem('cmrg_auth_session_v1', JSON.stringify(session));
    } else {
      localStorage.removeItem('cmrg_auth_session_v1');
    }
  }

  /**
   * Calculates actual stored byte sizes for photographs, audio evidence, signatures,
   * JSON answers, and remaining quota based on real data objects.
   */
  static getStorageAccounting(customQuotaMB?: number): import('../types/survey.ts').StorageAccounting {
    const submissions = this.getSubmissions();
    const forms = this.getForms();
    const capacity = this.getCapacityConfig();
    const quotaMB = customQuotaMB || capacity.maxStorageMB || 15360;

    let photosBytes = 0;
    let photosCount = 0;
    let audioBytes = 0;
    let audioCount = 0;
    let signaturesBytes = 0;
    let signaturesCount = 0;
    let submissionsJsonBytes = 0;

    for (const sub of submissions) {
      const answersStr = JSON.stringify(sub.answers || {});
      submissionsJsonBytes += answersStr.length;

      // Scan answers for base64 / dataUrl attachments
      if (sub.answers && typeof sub.answers === 'object') {
        for (const val of Object.values(sub.answers)) {
          if (typeof val === 'string') {
            if (val.startsWith('data:image')) {
              // base64 image length in bytes is approx length * 0.75
              const bytes = Math.round(val.length * 0.75);
              if (val.includes('signature') || val.length < 50000) {
                signaturesBytes += bytes;
                signaturesCount++;
              } else {
                photosBytes += bytes;
                photosCount++;
              }
            } else if (val.startsWith('data:audio')) {
              const bytes = Math.round(val.length * 0.75);
              audioBytes += bytes;
              audioCount++;
            }
          }
        }
      }

      if (sub.metadata?.audioAuditRecorded) {
        // baseline 16kHz audio audit average: 32 KB per interview
        audioBytes += (sub.metadata.durationSeconds || 60) * 800;
        audioCount++;
      }
    }

    const formsJsonBytes = JSON.stringify(forms).length;
    // Add 1.5MB base application manifest and offline worker cache
    const totalBytes = photosBytes + audioBytes + signaturesBytes + submissionsJsonBytes + formsJsonBytes + (1.5 * 1024 * 1024);
    const totalMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
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
      submissionsCount: submissions.length,
      remainingMB,
      quotaMB,
      percentUsed,
    };
  }

  static getStorageEstimate(): { usedMB: string; quotaMB: number; percent: number } {
    const acct = this.getStorageAccounting();
    return {
      usedMB: acct.totalMB.toFixed(1),
      quotaMB: acct.quotaMB,
      percent: Math.round(acct.percentUsed),
    };
  }
}

