import React, { useState } from 'react';
import {
  FolderSync,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Lock,
  Unlock,
  MapPin,
  PenTool,
  Search,
  Database,
  X,
  Volume2,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Submission, EnterpriseUserRole } from '../types/survey.ts';
import { decryptSurveyPayload } from '../lib/crypto.ts';
import { generatePostgreSqlDump } from '../lib/sqlEngine.ts';
import { batchSyncSubmissionsToCloud, syncSubmissionToCloud } from '../lib/firebase.ts';
import { cmrgApi } from '../lib/cmrgApi.ts';
import { StorageManager } from '../lib/storage.ts';

interface SubmissionsViewProps {
  submissions: Submission[];
  onTriggerSync: () => void;
  isSyncing: boolean;
  currentUserRole?: EnterpriseUserRole;
  currentUserName?: string;
  onSubmissionsUpdated?: (updated: Submission[]) => void;
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({
  submissions,
  onTriggerSync,
  isSyncing,
  currentUserRole = 'platform_admin',
  currentUserName = 'CMRG Reviewer',
  onSubmissionsUpdated,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [decryptedData, setDecryptedData] = useState<Record<string, any> | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptError, setDecryptError] = useState<string>('');
  const [showSqlExportModal, setShowSqlExportModal] = useState<boolean>(false);
  const [showCsvExportModal, setShowCsvExportModal] = useState<boolean>(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Firebase Cloud Sync Progress
  const [cloudSyncProgress, setCloudSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const canReview = currentUserRole === 'admin' || currentUserRole === 'platform_admin' || currentUserRole === 'org_admin' || currentUserRole === 'supervisor';

  const filtered = submissions.filter((sub) => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'pending') {
        if (sub.status !== 'submitted' && sub.status !== 'draft') return false;
      } else if (sub.status !== filterStatus) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        sub.formTitle.toLowerCase().includes(q) ||
        sub.enumeratorName.toLowerCase().includes(q) ||
        sub.instanceId.toLowerCase().includes(q) ||
        (sub.projectId && sub.projectId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'draft'
  ).length;

  const handleOpenDetails = (sub: Submission) => {
    setSelectedSub(sub);
    setDecryptedData(null);
    setDecryptError('');
  };

  const handleDecrypt = async () => {
    if (!selectedSub?.encryptedEnvelope) return;
    setIsDecrypting(true);
    setDecryptError('');
    try {
      const result = await decryptSurveyPayload(selectedSub.encryptedEnvelope);
      setDecryptedData(result);
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((s) => s.id));
    }
  };

  // Bulk Review Action (Approve, Reject, Flag)
  const handleBulkReview = async (action: 'approve' | 'reject' | 'flag', notes?: string) => {
    if (!selectedIds.length) return;
    setIsBulkProcessing(true);
    setBulkFeedback(null);

    const targetStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged';
    const now = new Date().toISOString();

    try {
      // 1. Call Server Bulk Review API
      await cmrgApi.bulkReviewSubmissions(
        selectedIds,
        action,
        notes || `Bulk review performed in CMRG Web Console`,
        currentUserName,
        currentUserRole
      ).catch(() => null);

      // 2. Update Local Storage
      const updatedList = submissions.map((s) => {
        if (selectedIds.includes(s.id)) {
          return {
            ...s,
            status: targetStatus as any,
            reviewedBy: currentUserName,
            reviewedAt: now,
            reviewNotes: notes || `Marked ${targetStatus} by ${currentUserName}`,
          };
        }
        return s;
      });

      StorageManager.saveSubmissions(updatedList);
      StorageManager.addAuditEvent({
        action: `BULK_${action.toUpperCase()}`,
        actor: currentUserName,
        actorRole: currentUserRole,
        target: `${selectedIds.length} Submissions`,
        details: `Batch changed status to ${targetStatus}.`,
      });

      if (onSubmissionsUpdated) onSubmissionsUpdated(updatedList);

      setBulkFeedback(`Successfully marked ${selectedIds.length} records as ${targetStatus.toUpperCase()}!`);
      setSelectedIds([]);
      setTimeout(() => setBulkFeedback(null), 3500);
    } catch (err: any) {
      setBulkFeedback(`Bulk action error: ${err.message}`);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Firebase Bulk Sync
  const handleFirebaseSync = async () => {
    setIsBulkProcessing(true);
    setBulkFeedback(null);
    setCloudSyncProgress({ current: 0, total: submissions.length });

    try {
      const targets = selectedIds.length
        ? submissions.filter((s) => selectedIds.includes(s.id))
        : submissions;

      const { successCount, failureCount } = await batchSyncSubmissionsToCloud(
        targets,
        (current, total) => setCloudSyncProgress({ current, total })
      );

      // Update local statuses to synced
      const updatedList = submissions.map((s) => {
        if (targets.some((t) => t.id === s.id)) {
          return { ...s, status: 'synced' as const, syncedAt: new Date().toISOString() };
        }
        return s;
      });

      StorageManager.saveSubmissions(updatedList);
      StorageManager.addAuditEvent({
        action: 'FIREBASE_CLOUD_SYNC',
        actor: currentUserName,
        actorRole: currentUserRole,
        target: 'Firebase Firestore',
        details: `Synchronized ${successCount} submissions to central cloud. Failures: ${failureCount}.`,
      });

      if (onSubmissionsUpdated) onSubmissionsUpdated(updatedList);

      setBulkFeedback(
        `Firebase Sync Complete: ${successCount} records synchronized successfully!${
          failureCount > 0 ? ` (${failureCount} retries pending)` : ''
        }`
      );
      setSelectedIds([]);
      setTimeout(() => setBulkFeedback(null), 4000);
    } catch (err: any) {
      setBulkFeedback(`Firebase sync error: ${err.message}`);
    } finally {
      setIsBulkProcessing(false);
      setCloudSyncProgress(null);
    }
  };

  // CSV Export Function (Both Detailed and Summary, works 100% offline and connects to server)
  const handleExportCsv = (type: 'detailed' | 'summary') => {
    const targets = selectedIds.length
      ? submissions.filter((s) => selectedIds.includes(s.id))
      : filtered;

    if (!targets.length) {
      alert('No submissions available to export.');
      return;
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
        'SubmittedAt',
        'SyncedAt',
      ];
      const rows = targets.map((s) => [
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

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        encodeURIComponent([headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n'));

      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `cmrg_summary_submissions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      // Detailed Wide-format CSV with flattened question columns
      const questionKeysSet = new Set<string>();
      for (const s of targets) {
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

      const rows = targets.map((s) => {
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

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        encodeURIComponent([allHeaders.join(','), ...rows].join('\r\n'));

      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `cmrg_detailed_dataset_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setShowCsvExportModal(false);
  };

  const exportJson = () => {
    const targets = selectedIds.length
      ? submissions.filter((s) => selectedIds.includes(s.id))
      : filtered;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(targets, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `cmrg_submissions_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const sqlDump = generatePostgreSqlDump(submissions);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950 font-sans text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            FIELD REPOSITORY &bull; QUALITY AUDITING &bull; CLOUD SYNC
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Questionnaire Submissions ({submissions.length})
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time fieldwork repository, CSV data exporter, supervisor quality reviews, and Firebase sync pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Firebase Cloud Sync Button */}
          <button
            onClick={handleFirebaseSync}
            disabled={isBulkProcessing || isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-orange-950/50 transition cursor-pointer"
          >
            <UploadCloud className={`w-4 h-4 ${isBulkProcessing ? 'animate-bounce' : ''}`} />
            <span>{isBulkProcessing ? 'Syncing Firebase...' : 'Sync to Firebase'}</span>
          </button>

          {/* Central DB Sync Button */}
          <button
            onClick={onTriggerSync}
            disabled={isSyncing || pendingCount === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-950/50 transition cursor-pointer"
          >
            <FolderSync className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : `Postgres Sync (${pendingCount})`}</span>
          </button>

          {/* CSV Export Options Modal Trigger */}
          <button
            onClick={() => setShowCsvExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* SQL Inserts */}
          <button
            onClick={() => setShowSqlExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>SQL</span>
          </button>

          {/* JSON Export */}
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Progress Bar */}
      {cloudSyncProgress && (
        <div className="p-3.5 rounded-2xl bg-orange-950/40 border border-orange-500/40 text-xs text-orange-200 space-y-2 animate-fadeIn">
          <div className="flex justify-between font-bold">
            <span className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-orange-400 animate-pulse" />
              <span>Uploading dataset to Google Firebase Firestore...</span>
            </span>
            <span>
              {cloudSyncProgress.current} / {cloudSyncProgress.total} records
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-orange-500/30">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{
                width: `${Math.round((cloudSyncProgress.current / cloudSyncProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bulk Feedback Banner */}
      {bulkFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{bulkFeedback}</span>
        </div>
      )}

      {/* Bulk Actions Toolbar (When items are selected) */}
      {selectedIds.length > 0 && canReview && (
        <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-600/50 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-red-400" />
            <span className="font-bold text-white">
              {selectedIds.length} submission{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-slate-400">for bulk supervisor review</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkReview('approve')}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bulk Approve</span>
            </button>
            <button
              onClick={() => handleBulkReview('flag')}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Bulk Flag</span>
            </button>
            <button
              onClick={() => handleBulkReview('reject')}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] shadow transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Bulk Reject</span>
            </button>
            <button
              onClick={() => handleExportCsv('detailed')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-[11px] transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Selected CSV</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-[11px]"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'synced', label: 'Synced' },
            { id: 'flagged', label: 'Flagged' },
            { id: 'rejected', label: 'Rejected' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider text-[10px] transition ${
                filterStatus === st.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by form, surveyor, instance ID..."
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:border-red-500 outline-none"
          />
        </div>
      </div>

      {/* Submissions Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-slate-400 hover:text-white"
                    title="Select / Deselect All"
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-red-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Instance ID</th>
                <th className="py-3 px-4">Study / Form</th>
                <th className="py-3 px-4">Field Officer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit Speed</th>
                <th className="py-3 px-4">GPS / Sensors</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {filtered.map((sub) => {
                const isSelected = selectedIds.includes(sub.id);
                const isApproved = sub.status === 'approved';
                const isRejected = sub.status === 'rejected';
                const isSynced = sub.status === 'synced';
                const isFlagged = sub.status === 'flagged';

                return (
                  <tr
                    key={sub.id}
                    className={`hover:bg-slate-800/40 transition ${
                      isSelected ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(sub.id)}
                        className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {sub.instanceId.substring(0, 14)}...
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{sub.formTitle}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        v{sub.formVersion} &bull; {sub.projectId || 'PRJ-CMRG-2026-FMCG'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-white font-medium">{sub.enumeratorName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{sub.deviceId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isSynced
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : isFlagged
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : isRejected
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {isApproved && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {isSynced && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {isFlagged && <AlertTriangle className="w-2.5 h-2.5" />}
                        <span>{sub.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div>{sub.metadata?.durationSeconds || 0}s</div>
                      <div className="text-[10px] text-slate-500">
                        {sub.metadata?.networkAtSubmission || 'online'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px]">
                      {sub.metadata?.latitude ? (
                        <div className="flex items-center gap-1 text-emerald-400 font-mono">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {sub.metadata.latitude.toFixed(4)}, {sub.metadata.longitude?.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">No GPS</span>
                      )}
                      {sub.metadata?.audioAuditRecorded && (
                        <div className="flex items-center gap-1 text-red-400 text-[10px] mt-0.5">
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>Audio Audited</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetails(sub)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Export Options Modal */}
      {showCsvExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Export Dataset as CSV</h3>
              </div>
              <button
                onClick={() => setShowCsvExportModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select your desired CSV structure. Generates SurveyCTO-compatible datasets ready for Stata, R, SPSS, Python, and Excel.
            </p>

            <div className="space-y-3">
              {/* Detailed Wide Format */}
              <button
                onClick={() => handleExportCsv('detailed')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs group-hover:text-emerald-400">
                    Comprehensive Wide-Format CSV (Full Survey Variables)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 font-mono">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Unpacks all survey question variables (`q_store_name`, `q_store_type`, etc.) into individual CSV columns. Includes audit durations, GPS coordinates, review notes, and metadata.
                </p>
              </button>

              {/* Summary Metadata Format */}
              <button
                onClick={() => handleExportCsv('summary')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-left transition space-y-1 group"
              >
                <div className="font-bold text-white text-xs group-hover:text-blue-400">
                  Operational Summary CSV (Metadata & GPS Only)
                </div>
                <p className="text-[11px] text-slate-400">
                  Exports core submission metadata: Instance ID, Survey Protocol, Project ID, Enumerator Name, Status, Timestamps, and Coordinates.
                </p>
              </button>

              {/* Server Endpoint Direct Link */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Direct API Endpoint:</span>
                <a
                  href="/api/export/csv?type=detailed"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-red-400 hover:underline flex items-center gap-1"
                >
                  <span>/api/export/csv?type=detailed</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCsvExportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Export Modal */}
      {showSqlExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-black text-white">PostgreSQL Data Dump</h3>
              </div>
              <button
                onClick={() => setShowSqlExportModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <textarea
              readOnly
              value={sqlDump}
              className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlDump);
                  alert('SQL dump copied to clipboard!');
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Copy SQL
              </button>
              <button
                onClick={() => setShowSqlExportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">{selectedSub.formTitle}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Instance: {selectedSub.instanceId}
                </p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Field Officer</div>
                <div className="font-bold text-white mt-0.5">{selectedSub.enumeratorName}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
                <div className="font-bold text-red-400 uppercase mt-0.5">{selectedSub.status}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Duration</div>
                <div className="font-bold text-white mt-0.5">{selectedSub.metadata?.durationSeconds || 0}s</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Audio Audit</div>
                <div className="font-bold text-emerald-400 mt-0.5">
                  {selectedSub.metadata?.audioAuditRecorded ? 'Verified Recorded' : 'None'}
                </div>
              </div>
            </div>

            {/* Review Controls (for supervisor) */}
            {canReview && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-white">Supervisor Review:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleBulkReview('approve');
                      setSelectedSub({ ...selectedSub, status: 'approved' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      handleBulkReview('flag');
                      setSelectedSub({ ...selectedSub, status: 'flagged' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
                  >
                    Flag
                  </button>
                  <button
                    onClick={() => {
                      handleBulkReview('reject');
                      setSelectedSub({ ...selectedSub, status: 'rejected' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Answers JSON Display */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">Survey Answers:</div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                {JSON.stringify(decryptedData || selectedSub.answers, null, 2)}
              </pre>
            </div>

            {/* Cryptographic envelope decrypt button if encrypted */}
            {selectedSub.encryptedEnvelope && !decryptedData && (
              <div className="p-4 rounded-2xl bg-red-950/30 border border-red-800/40 space-y-2 text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-500" />
                  <span>Payload Protected by End-to-End Envelope Encryption</span>
                </div>
                <button
                  onClick={handleDecrypt}
                  disabled={isDecrypting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isDecrypting ? 'Decrypting...' : 'Decrypt with CMRG Private Key'}</span>
                </button>
                {decryptError && <div className="text-red-400 text-[11px]">{decryptError}</div>}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
