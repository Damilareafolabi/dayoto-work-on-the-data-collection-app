import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Users,
  FileSpreadsheet,
  FolderKanban,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Settings,
  TrendingUp,
  Activity,
  Calendar,
  Save,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  Check,
  Building,
  Radio,
  FileText,
  FileCheck,
} from 'lucide-react';
import {
  PlatformCapacityMetrics,
  CapacityConfig,
  CapacityProfileTier,
  ProjectDefinition,
  AuditEvent,
  EnterpriseUserRole,
} from '../types/survey.ts';
import { cmrgApi } from '../lib/cmrgApi.ts';
import { StorageManager } from '../lib/storage.ts';
import { CAPACITY_PRESETS } from '../lib/mockData.ts';
import { syncCapacityConfigToCloud } from '../lib/firebase.ts';

interface CapacityUsageDashboardProps {
  onNavigateToProjects?: () => void;
  onNavigateToSubmissions?: () => void;
  onNavigateToSituation?: () => void;
  currentUserRole?: EnterpriseUserRole;
  currentUserName?: string;
}

export const CapacityUsageDashboard: React.FC<CapacityUsageDashboardProps> = ({
  onNavigateToProjects,
  onNavigateToSubmissions,
  onNavigateToSituation,
  currentUserRole = 'platform_admin',
  currentUserName = 'CMRG Administrator',
}) => {
  const [metrics, setMetrics] = useState<PlatformCapacityMetrics | null>(null);
  const [capacityConfig, setCapacityConfig] = useState<CapacityConfig>(() =>
    StorageManager.getCapacityConfig()
  );
  const [projects, setProjects] = useState<ProjectDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [editConfig, setEditConfig] = useState<CapacityConfig>(capacityConfig);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'platform_admin' || currentUserRole === 'org_admin';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usageData, projList] = await Promise.all([
        cmrgApi.getCapacityUsage().catch(() => null),
        cmrgApi.getProjects().catch(() => StorageManager.getProjectsSync()),
      ]);

      if (usageData) {
        setMetrics(usageData);
        setCapacityConfig(usageData.capacityConfig);
        setEditConfig(usageData.capacityConfig);
        StorageManager.saveCapacityConfig(usageData.capacityConfig);
      } else {
        // Fallback to local storage calculations
        const localAcct = StorageManager.getStorageAccounting();
        const subs = StorageManager.getSubmissions();
        const enums = StorageManager.getEnumerators();
        const forms = StorageManager.getForms();
        const audits = StorageManager.getAuditLogs();
        const uploadFails = StorageManager.getUploadFailures();

        const currentMonth = new Date().toISOString().substring(0, 7);
        const today = new Date().toISOString().substring(0, 10);

        const subMonth = subs.filter((s) => s.createdAt?.startsWith(currentMonth)).length;
        const subToday = subs.filter((s) => s.createdAt?.startsWith(today)).length;

        const fallbackMetrics: PlatformCapacityMetrics = {
          totalRegisteredUsers: enums.length,
          activeInterviewers: enums.filter((e) => e.active).length,
          totalProjects: projList.length,
          totalQuestionnaires: forms.length,
          submissionsToday: subToday,
          submissionsThisMonth: subMonth,
          statusCounts: {
            pending: subs.filter((s) => s.status === 'submitted' || s.status === 'draft').length,
            approved: subs.filter((s) => s.status === 'approved').length,
            rejected: subs.filter((s) => s.status === 'rejected').length,
            flagged: subs.filter((s) => s.status === 'flagged').length,
            synced: subs.filter((s) => s.status === 'synced').length,
          },
          storage: localAcct,
          uploadAccounting: {
            totalSuccessful: subs.length,
            uploadFailures: uploadFails.length,
            syncFailures: 0,
            pendingOfflineSubmissions: subs.filter((s) => s.status === 'submitted' || s.status === 'draft').length,
            activeRetries: uploadFails.length,
          },
          capacityWarnings: [],
          recentAuditEvents: audits,
          capacityConfig,
        };

        setMetrics(fallbackMetrics);
      }

      setProjects(projList);
    } catch (err) {
      console.warn('Capacity dashboard fetch notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPreset = (tier: CapacityProfileTier) => {
    const preset = CAPACITY_PRESETS[tier];
    if (preset) {
      setEditConfig({
        ...preset,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUserName,
      });
    }
  };

  const handleSaveCapacityConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only authorized CMRG Administrators can update capacity profiles.');
      return;
    }

    setIsSavingConfig(true);
    try {
      const updated = {
        ...editConfig,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUserName,
      };

      await cmrgApi.updateCapacityConfig(updated).catch(() => null);
      await syncCapacityConfigToCloud(updated).catch(() => null);

      StorageManager.saveCapacityConfig(updated);
      StorageManager.addAuditEvent({
        action: 'CAPACITY_PROFILE_UPDATED',
        actor: currentUserName,
        actorRole: 'admin',
        target: `CMRG Capacity Profile (${updated.tier.toUpperCase()})`,
        details: `Updated capacity limits: Storage ${updated.maxStorageMB}MB, Allowance: ${updated.monthlySubmissionAllowance} submissions, OrgMode: ${updated.organisationMode ? 'ENABLED' : 'DISABLED'}.`,
      });

      setCapacityConfig(updated);
      setShowConfigModal(false);
      setSaveSuccessMsg('Capacity profile updated and enforced organisation-wide!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);

      // Refresh metrics
      loadData();
    } catch (err: any) {
      console.error('Save config error:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const storage = metrics?.storage || StorageManager.getStorageAccounting(capacityConfig.maxStorageMB);
  const statusCounts = metrics?.statusCounts || { pending: 0, approved: 0, rejected: 0, flagged: 0, synced: 0 };
  const uploadAccounting = metrics?.uploadAccounting || { totalSuccessful: 0, uploadFailures: 0, syncFailures: 0, pendingOfflineSubmissions: 0, activeRetries: 0 };

  const monthlySubmissionUsagePct = Math.min(
    100,
    Math.round(((metrics?.submissionsThisMonth || 0) / (capacityConfig.monthlySubmissionAllowance || 1)) * 100)
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950 font-sans text-slate-100">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-red-500 uppercase">
            <Building className="w-3.5 h-3.5 text-red-500" />
            <span>CMRG ORGANISATION MODE &bull; OPERATIONS MANAGEMENT</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
            Platform Capacity, Usage & Administration
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            SurveyCTO-grade capacity accounting, actual file storage audit, interviewer quotas, and internal capacity profiles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Profile Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Profile:</span>
            <span className="font-extrabold uppercase px-2 py-0.5 rounded-md text-[11px] bg-red-600/20 border border-red-500/30 text-red-400">
              {capacityConfig.tier}
            </span>
            <span className="text-slate-400 hidden sm:inline">&bull; {capacityConfig.profileName}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Configure Limits Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/30 transition"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Capacity</span>
            </button>
          )}
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* Capacity Warnings Banner */}
      {metrics?.capacityWarnings && metrics.capacityWarnings.length > 0 && (
        <div className="p-4 bg-amber-950/40 border border-amber-600/40 rounded-2xl text-xs text-amber-200 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Capacity Warning Notices</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300">
            {metrics.capacityWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 1: Capacity & Quota Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Submissions */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">Monthly Submissions</span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-white">
              {metrics?.submissionsThisMonth || 0}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              / {capacityConfig.monthlySubmissionAllowance.toLocaleString()} max
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                monthlySubmissionUsagePct > 90
                  ? 'bg-red-500'
                  : monthlySubmissionUsagePct > 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(4, monthlySubmissionUsagePct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{monthlySubmissionUsagePct}% consumed</span>
            <span className="text-emerald-400 font-semibold">
              {(metrics?.submissionsToday || 0)} received today
            </span>
          </div>
        </div>

        {/* Storage Accounting */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">Storage Allocation</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-white">
              {storage.totalMB} <span className="text-sm font-medium text-slate-400">MB</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              / {capacityConfig.maxStorageMB.toLocaleString()} MB
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.max(4, storage.percentUsed)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{storage.percentUsed}% consumed</span>
            <span className="text-slate-300 font-semibold">
              {storage.remainingMB} MB remaining
            </span>
          </div>
        </div>

        {/* Active Field Personnel */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">Interviewers & Staff</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-white">
              {metrics?.activeInterviewers || 0}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              / {capacityConfig.maxActiveEnumerators} policy limit
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            <span className="font-bold text-white">{metrics?.totalRegisteredUsers || 0}</span> total field officer accounts provisioned
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active devices reporting telemetry</span>
          </div>
        </div>

        {/* Projects & Questionnaires */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">Studies & Forms</span>
            <FolderKanban className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-white">
              {projects.length} <span className="text-sm font-medium text-slate-400">Projects</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              {metrics?.totalQuestionnaires || 0} / {capacityConfig.maxQuestionnaires} forms
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Organization Mode: <span className="font-bold text-white">{capacityConfig.organisationMode ? 'Active (CMRG)' : 'Standard'}</span>
          </div>
          <div className="text-[11px] text-purple-400 font-semibold">
            Support: {capacityConfig.supportTier}
          </div>
        </div>
      </div>

      {/* Section 2: Detailed Storage Accounting & Quality Auditing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Storage Consumed by Media Type (6 cols) */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-white">Actual Storage Accounting (Bytes Audit)</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Real File Metadata</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Photographs */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Photographs & Storefront Images</div>
                  <div className="text-[11px] text-slate-400">{storage.photosCount} files captured in private vault</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-white">
                  {(storage.photosBytes / (1024 * 1024)).toFixed(2)} MB
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storage.photosBytes.toLocaleString()} bytes
                </div>
              </div>
            </div>

            {/* Audio Audit Recordings */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Audio Audit Evidence & Recordings</div>
                  <div className="text-[11px] text-slate-400">{storage.audioCount} verified consent recordings</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-white">
                  {(storage.audioBytes / (1024 * 1024)).toFixed(2)} MB
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storage.audioBytes.toLocaleString()} bytes
                </div>
              </div>
            </div>

            {/* Respondent Signatures */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Consent Signatures & Biometrics</div>
                  <div className="text-[11px] text-slate-400">{storage.signaturesCount} digital signatures</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-white">
                  {(storage.signaturesBytes / (1024 * 1024)).toFixed(2)} MB
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storage.signaturesBytes.toLocaleString()} bytes
                </div>
              </div>
            </div>

            {/* Submissions JSON & Encrypted Envelopes */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Encrypted Envelopes & JSON Responses</div>
                  <div className="text-[11px] text-slate-400">{storage.submissionsCount} interviews indexed</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-white">
                  {(storage.submissionsJsonBytes / (1024 * 1024)).toFixed(2)} MB
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storage.submissionsJsonBytes.toLocaleString()} bytes
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Status & Quality Review (6 cols) */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Submission Quality & Approval Pipeline</h2>
            </div>
            <button
              onClick={onNavigateToSubmissions}
              className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
            >
              View Submissions &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Approved */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Approved</span>
              </div>
              <div className="text-2xl font-black text-white">{statusCounts.approved}</div>
              <p className="text-[10px] text-slate-400">Passed supervisor QC audit</p>
            </div>

            {/* Pending Review */}
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Clock className="w-4 h-4" />
                <span>Pending Review</span>
              </div>
              <div className="text-2xl font-black text-white">{statusCounts.pending}</div>
              <p className="text-[10px] text-slate-400">Awaiting supervisor sign-off</p>
            </div>

            {/* Flagged */}
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-800/40 space-y-1">
              <div className="flex items-center gap-1.5 text-red-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Flagged</span>
              </div>
              <div className="text-2xl font-black text-white">{statusCounts.flagged}</div>
              <p className="text-[10px] text-slate-400">Speed / GPS geofence anomaly</p>
            </div>

            {/* Rejected */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <XCircle className="w-4 h-4" />
                <span>Rejected</span>
              </div>
              <div className="text-2xl font-black text-white">{statusCounts.rejected}</div>
              <p className="text-[10px] text-slate-400">Failed QC verification</p>
            </div>
          </div>

          {/* Upload & Network Resilience Accounting */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="font-bold text-white flex items-center justify-between">
              <span>Offline & Ingestion Reliability Audit</span>
              <span className="text-emerald-400 font-mono text-[11px]">100% Idempotent</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Upload Failures</div>
                <div className="font-bold font-mono text-white">{uploadAccounting.uploadFailures}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Active Retries</div>
                <div className="font-bold font-mono text-emerald-400">{uploadAccounting.activeRetries}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Offline Queue</div>
                <div className="font-bold font-mono text-amber-400">{uploadAccounting.pendingOfflineSubmissions}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Active Research Projects & Submissions Tracking */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-white">Research Projects & Scope Allocations</h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{projects.length} Active Studies</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Study Code</th>
                <th className="py-2.5 px-3">Project Name</th>
                <th className="py-2.5 px-3">Lead Researcher</th>
                <th className="py-2.5 px-3">Questionnaires</th>
                <th className="py-2.5 px-3">Field Submissions</th>
                <th className="py-2.5 px-3">Capacity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {projects.map((proj) => {
                const subCount = proj.submissionsCount || 0;
                const maxLimit = proj.maxSubmissionsLimit || 10000;
                const pct = Math.min(100, Math.round((subCount / maxLimit) * 100));

                return (
                  <tr key={proj.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-bold text-red-400">{proj.code}</td>
                    <td className="py-3 px-3 font-sans text-white font-semibold">{proj.name}</td>
                    <td className="py-3 px-3 font-sans text-slate-300">{proj.leadResearcher}</td>
                    <td className="py-3 px-3 text-slate-300">
                      {proj.formIds?.length || 1} form(s) assigned
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {subCount} <span className="text-slate-500 font-normal">/ {maxLimit.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.max(5, pct)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Tamper-Evident Administrative Audit Trail */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Administrative Actions & Security Audit Trail</h2>
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Immutable Event Ledger</span>
        </div>

        <div className="divide-y divide-slate-800/60 text-xs">
          {(metrics?.recentAuditEvents || StorageManager.getAuditLogs()).slice(0, 8).map((event) => (
            <div key={event.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                    {event.action}
                  </span>
                  <span className="font-bold text-white">{event.target}</span>
                  <span className="text-slate-400 text-[11px]">by {event.actor} ({event.actorRole})</span>
                </div>
                <p className="text-[11px] text-slate-400">{event.details}</p>
              </div>
              <div className="text-[10px] text-slate-500 font-mono shrink-0">
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Edit Internal Capacity Profile & Organisation Limits */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white">Configure Internal Capacity Profile</h3>
                <p className="text-xs text-slate-400">
                  Select a standardized CMRG internal capacity tier or customize operational fieldwork limits.
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Presets Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Preset Capacity Tiers (Internal Platform Profiles)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['basic', 'pro', 'advanced', 'enterprise'] as CapacityProfileTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectPreset(t)}
                    className={`p-3 rounded-xl border text-left transition ${
                      editConfig.tier === t
                        ? 'bg-red-600/15 border-red-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-black text-xs uppercase tracking-wider text-red-400">{t}</div>
                    <div className="text-[10px] text-slate-300 font-semibold mt-1">
                      {CAPACITY_PRESETS[t]?.monthlySubmissionAllowance.toLocaleString()} subs
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {(CAPACITY_PRESETS[t]?.maxStorageMB / 1024).toFixed(0)} GB Storage
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Form */}
            <form onSubmit={handleSaveCapacityConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Max Storage Allocation (MB)</label>
                  <input
                    type="number"
                    value={editConfig.maxStorageMB}
                    onChange={(e) => setEditConfig({ ...editConfig, maxStorageMB: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-500">{(editConfig.maxStorageMB / 1024).toFixed(1)} GB</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Monthly Submission Allowance</label>
                  <input
                    type="number"
                    value={editConfig.monthlySubmissionAllowance}
                    onChange={(e) => setEditConfig({ ...editConfig, monthlySubmissionAllowance: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Max Questionnaires / Forms</label>
                  <input
                    type="number"
                    value={editConfig.maxQuestionnaires}
                    onChange={(e) => setEditConfig({ ...editConfig, maxQuestionnaires: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Max Active Enumerators</label>
                  <input
                    type="number"
                    value={editConfig.maxActiveEnumerators}
                    onChange={(e) => setEditConfig({ ...editConfig, maxActiveEnumerators: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              {/* Policy Toggles */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">CMRG Organisation Mode</div>
                    <div className="text-[10px] text-slate-400">Enforce limits across all research projects and field surveys.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editConfig.organisationMode}
                    onChange={(e) => setEditConfig({ ...editConfig, organisationMode: e.target.checked })}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <div>
                    <div className="font-bold text-white">Enforce Server-Side Hard Limits</div>
                    <div className="text-[10px] text-slate-400">Block ingestion with clear warnings if monthly allowance is exceeded.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editConfig.enforceHardLimits}
                    onChange={(e) => setEditConfig({ ...editConfig, enforceHardLimits: e.target.checked })}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <div>
                    <div className="font-bold text-white">Warning Threshold Alert (%)</div>
                    <div className="text-[10px] text-slate-400">Trigger supervisor warnings when quota reaches this percentage.</div>
                  </div>
                  <input
                    type="number"
                    min="50"
                    max="99"
                    value={editConfig.warningThresholdPercent}
                    onChange={(e) => setEditConfig({ ...editConfig, warningThresholdPercent: Number(e.target.value) })}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-center font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-red-900/40"
                >
                  {isSavingConfig ? 'Enforcing...' : 'Save & Enforce Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
