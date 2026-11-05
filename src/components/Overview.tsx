import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  ChevronRight,
  Shield,
  Activity,
  ArrowRight,
  Radio,
  Sparkles,
} from 'lucide-react';
import { Submission, FormDefinition } from '../types/survey.ts';
import { StorageManager } from '../lib/storage.ts';

interface OverviewProps {
  onStartCollecting: () => void;
  onNavigateToForms: () => void;
  onNavigateToSubmissions: () => void;
  onNavigateToSituation: () => void;
  onTriggerSync: () => void;
  submissions: Submission[];
  forms: FormDefinition[];
  isSyncing: boolean;
}

export const Overview: React.FC<OverviewProps> = ({
  onStartCollecting,
  onNavigateToForms,
  onNavigateToSubmissions,
  onNavigateToSituation,
  onTriggerSync,
  submissions,
  forms,
  isSyncing,
}) => {
  const pendingSync = submissions.filter((s) => s.status === 'submitted' || s.status === 'draft');
  const syncedCount = submissions.filter((s) => s.status === 'synced').length;
  const flaggedCount = submissions.filter((s) => s.status === 'flagged').length;
  const storage = StorageManager.getStorageEstimate();

  const activeFormsCount = forms.filter((f) => f.active).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-950">
      {/* Top Header matching user screenshot */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            COMMUNICATION AND MARKETING RESEARCH GROUP
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
            Data collection overview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">Device storage active</span>
            <span className="text-slate-500 font-mono text-[10px]">({storage.usedMB} MB)</span>
          </div>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <UploadCloud className={`w-3.5 h-3.5 text-red-400 ${isSyncing ? 'animate-bounce' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Central Sync'}
          </button>
        </div>
      </div>

      {/* Hero Banner matching the screenshot */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl p-6 md:p-10">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Text Content */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-extrabold tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              CMRG FIELDWORK
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">
                Collect anywhere.
              </h2>
              <h2 className="text-3xl md:text-5xl font-black text-red-500 tracking-tight leading-none">
                Sync when ready.
              </h2>
            </div>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
              Import existing ODK forms, collect responses on this device and export your
              data. Central synchronization must be configured before production use.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onStartCollecting}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-950/60 hover:shadow-red-900/40 transition-all cursor-pointer active:scale-95"
              >
                <span>Start collecting</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onNavigateToForms}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Manage Forms ({forms.length})</span>
              </button>

              <button
                onClick={onNavigateToSituation}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>Situation Room</span>
              </button>
            </div>
          </div>

          {/* Right Smartphone Illustration matching the screenshot */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="relative">
              {/* Smartphone Frame */}
              <div className="w-64 h-[340px] bg-slate-950 rounded-[32px] p-2.5 shadow-2xl border-4 border-slate-700 relative">
                {/* Speaker pill notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-2 bg-slate-800 rounded-full" />

                {/* Inner Screen */}
                <div className="w-full h-full bg-slate-900 rounded-[24px] pt-8 p-3 flex flex-col justify-between overflow-hidden border border-slate-800">
                  <div className="space-y-2">
                    {/* Header bar on phone */}
                    <div className="h-10 rounded-lg bg-red-600 flex items-center px-3 gap-2">
                      <div className="w-4 h-4 rounded bg-white/20" />
                      <div className="h-2 w-20 bg-white/80 rounded" />
                    </div>

                    {/* Form input slots */}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-1.5 w-16 bg-slate-700 rounded" />
                      <div className="h-7 w-full bg-slate-800/90 rounded border border-slate-700 px-2 flex items-center">
                        <div className="h-1.5 w-24 bg-slate-600 rounded" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-1.5 w-20 bg-slate-700 rounded" />
                      <div className="h-7 w-full bg-slate-800/90 rounded border border-slate-700 px-2 flex items-center">
                        <div className="h-1.5 w-32 bg-slate-600 rounded" />
                      </div>
                    </div>

                    {/* Radio group */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-red-500 bg-red-500/20" />
                        <div className="h-1.5 w-28 bg-slate-600 rounded" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-slate-700" />
                        <div className="h-1.5 w-20 bg-slate-700 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Submit red button on mockup */}
                  <div className="pt-2">
                    <div className="h-8 rounded-lg bg-red-600 flex items-center justify-center">
                      <div className="h-2 w-14 bg-white/90 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Verified checkmark badge floating next to phone */}
              <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 shadow-xl flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              {/* Encryption badge top left */}
              <div className="absolute -top-3 -left-3 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 shadow-lg flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Submissions */}
        <div
          onClick={onNavigateToSubmissions}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Submissions</span>
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white transition">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{submissions.length}</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{syncedCount} synced</span>
            <span>•</span>
            <span>{submissions.length} total collected</span>
          </div>
        </div>

        {/* Awaiting Sync */}
        <div
          onClick={onNavigateToSubmissions}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Awaiting sync</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{pendingSync.length}</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Stored in device storage</span>
            {pendingSync.length > 0 && (
              <span className="text-[10px] font-bold text-amber-400 underline">Sync now</span>
            )}
          </div>
        </div>

        {/* Active Forms */}
        <div
          onClick={onNavigateToForms}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Forms</span>
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white transition">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{activeFormsCount}</div>
          <div className="mt-2 text-xs text-slate-400">
            <span>Active field questionnaires ready</span>
          </div>
        </div>

        {/* Quality & Situation Status */}
        <div
          onClick={onNavigateToSituation}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Quality Audits</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-white">
              {Math.max(0, 100 - flaggedCount * 8)}%
            </div>
            {flaggedCount > 0 && (
              <span className="text-xs text-red-400 font-bold">({flaggedCount} flagged)</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            <span>Situation Room Live</span>
          </div>
        </div>
      </div>

      {/* Recent Submissions Feed */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white">Recent Field Submissions</h3>
          </div>
          <button
            onClick={onNavigateToSubmissions}
            className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>View all ({submissions.length})</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {submissions.slice(0, 4).map((sub) => {
            const isSynced = sub.status === 'synced';
            const isFlagged = sub.status === 'flagged';

            return (
              <div
                key={sub.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{sub.formTitle}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        isSynced
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isFlagged
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span>Surveyor: <strong className="text-slate-300">{sub.enumeratorName}</strong></span>
                    <span>•</span>
                    <span>Duration: <strong className="text-slate-300">{sub.metadata.durationSeconds}s</strong></span>
                    <span>•</span>
                    <span>{new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {sub.metadata.audioAuditRecorded && (
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
                      Audio Audit
                    </span>
                  )}
                  {sub.metadata.latitude && (
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono border border-slate-700">
                      GPS: {sub.metadata.latitude.toFixed(2)}, {sub.metadata.longitude?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
