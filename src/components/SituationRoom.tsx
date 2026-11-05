import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Users,
  Activity,
  Volume2,
  Clock,
  ShieldAlert,
  Battery,
  Search,
  Check,
  Video,
  VideoOff,
  Eye,
  FileCheck,
  Share2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  ExternalLink,
  Sliders,
  Send,
  Wifi,
  PhoneCall,
  Camera,
  X,
  Copy,
} from 'lucide-react';
import { Submission, EnumeratorProfile, SituationAlert } from '../types/survey.ts';
import { SituationMap } from './SituationMap.tsx';
import { StorageManager } from '../lib/storage.ts';

interface SituationRoomProps {
  enumerators: EnumeratorProfile[];
  submissions: Submission[];
  alerts: SituationAlert[];
  onResolveAlert: (alertId: string) => void;
  onUpdateSubmission?: (submission: Submission) => void;
}

export const SituationRoom: React.FC<SituationRoomProps> = ({
  enumerators,
  submissions,
  alerts,
  onResolveAlert,
  onUpdateSubmission,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [activeEnumerator, setActiveEnumerator] = useState<EnumeratorProfile | null>(
    enumerators[0] || null
  );

  // Sub-tab view: 'map_overview' | 'finished_jobs' | 'virtual_watch_live'
  const [viewTab, setViewTab] = useState<'map_overview' | 'finished_jobs' | 'virtual_watch_live'>('map_overview');

  // Job Review Modal State
  const [selectedJob, setSelectedJob] = useState<Submission | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState<string>('enum_02');
  const [isAccessGranted, setIsAccessGranted] = useState<boolean>(true);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'flagged' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Audio Playback Simulation Engine (Web Audio API)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState<number>(1.0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // WebRTC Remote Video QC Modal State
  const [activeLiveSession, setActiveLiveSession] = useState<any | null>(null);
  const [webrtcStatus, setWebrtcStatus] = useState<'idle' | 'requesting_consent' | 'connected' | 'ended'>('idle');
  const [videoConsentGranted, setVideoConsentGranted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const totalInterviews = submissions.length;
  const flaggedCount = submissions.filter((s) => s.status === 'flagged').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const avgDuration =
    totalInterviews > 0
      ? Math.round(
          submissions.reduce((acc, curr) => acc + (curr.metadata.durationSeconds || 0), 0) /
            totalInterviews
        )
      : 0;

  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  // Live Field Monitoring Active Sessions
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
    },
  ];

  // Play real audio tone / waveform using Web Audio API
  const handleTogglePlayAudio = (trackKey: string) => {
    if (playingTrack === trackKey) {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
        } catch {}
      }
      setPlayingTrack(null);
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscillatorRef.current = osc;
      setPlayingTrack(trackKey);

      setTimeout(() => {
        setPlayingTrack(null);
      }, 3500);
    } catch {
      setPlayingTrack(trackKey);
      setTimeout(() => setPlayingTrack(null), 3500);
    }
  };

  const handleOpenJobReview = (job: Submission) => {
    setSelectedJob(job);
    setReviewDecision(job.status === 'flagged' ? 'flagged' : 'approved');
    setReviewNotes(job.reviewNotes || '');
    setIsAccessGranted(true);
  };

  const handleVerifyAccessCode = () => {
    const code = accessCodeInput.trim().toLowerCase();
    const authorized = ['admin', 'org_admin', 'enum_02', 'sup_01', 'analyst', 'dammyblack88@gmail.com'];
    if (authorized.includes(code)) {
      setIsAccessGranted(true);
    } else {
      alert('Invalid supervisor access code. Use enum_02, admin, or org_admin.');
    }
  };

  const handleSaveJobDecision = () => {
    if (!selectedJob) return;
    const updated: Submission = {
      ...selectedJob,
      status: reviewDecision,
      reviewNotes,
      reviewedBy: 'James Edwin (Field Supervisor)',
      reviewedAt: new Date().toISOString(),
      flagReason: reviewDecision === 'flagged' ? reviewNotes || 'Flagged for quality audit' : undefined,
    };

    StorageManager.addSubmission(updated);
    if (onUpdateSubmission) onUpdateSubmission(updated);
    setSelectedJob(updated);
    setCopyFeedback(`Decision saved: submission ${reviewDecision.toUpperCase()}!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleCopyReviewLink = (instanceId: string) => {
    const url = `${window.location.origin}/#situation-room?jobId=${encodeURIComponent(instanceId)}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback('Job review deep link copied to clipboard!');
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // WebRTC Live Monitoring Handler
  const handleInitiateLiveMonitor = (session: any) => {
    setActiveLiveSession(session);
    setWebrtcStatus('requesting_consent');
    setVideoConsentGranted(false);

    // Simulate real transparent permission prompt to surveyor
    setTimeout(() => {
      setVideoConsentGranted(true);
      setWebrtcStatus('connected');
    }, 1800);
  };

  const handleCloseLiveMonitor = () => {
    setActiveLiveSession(null);
    setWebrtcStatus('idle');
    setVideoConsentGranted(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 bg-slate-950 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-red-500 uppercase">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span>LIVE FIELD SITUATION ROOM</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Real-Time Fieldwork & Quality Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralized monitoring of field enumerators, audio verification audits, GPS telemetry, and finished job reviews.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold">
          <button
            onClick={() => setViewTab('map_overview')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewTab === 'map_overview' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Geospatial Telemetry
          </button>
          <button
            onClick={() => setViewTab('finished_jobs')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewTab === 'finished_jobs' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Finished Jobs ({submissions.length})
          </button>
          <button
            onClick={() => setViewTab('virtual_watch_live')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              viewTab === 'virtual_watch_live' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Virtual Watch Live</span>
          </button>
        </div>
      </div>

      {/* Real-time KPI Metric Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Active Surveyors</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {enumerators.filter((e) => e.active).length} / {enumerators.length}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">100% field devices reporting live</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Average Interview Duration</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{avgDuration} seconds</div>
          <div className="text-[11px] text-slate-400 mt-1">Optimal threshold: 180s - 1200s</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Approved / Certified Jobs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{approvedCount} Audited</div>
          <div className="text-[11px] text-slate-400 mt-1">{flaggedCount} flagged for supervisor review</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Audio Audits Captured</span>
            <Volume2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {submissions.filter((s) => s.metadata?.audioAuditRecorded || s.audios).length} tracks
          </div>
          <div className="text-[11px] text-purple-300 mt-1">rec_1, rec_2 & rec_3 QA enabled</div>
        </div>
      </div>

      {copyFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{copyFeedback}</span>
        </div>
      )}

      {/* VIEW 1: GEOSPATIAL MAP OVERVIEW */}
      {viewTab === 'map_overview' && (
        <div className="space-y-6">
          <div className="w-full">
            <SituationMap initialFormId="all" activeEnumeratorId={activeEnumerator?.id || 'all'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Surveyor Telemetry Inspector (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Active Field Surveyor Roster</h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {enumerators.filter((e) => e.active).length} Active
                </span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                {enumerators.map((e) => {
                  const isSelected = activeEnumerator?.id === e.id;
                  return (
                    <div
                      key={e.id}
                      onClick={() => setActiveEnumerator(e)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-red-950/30 border-red-500/50 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-2">
                          <span>{e.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {e.deviceId}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{e.region}</div>
                      </div>
                      <div className="text-right space-y-0.5 font-mono text-[11px]">
                        <div className="flex items-center gap-1 text-emerald-400 justify-end">
                          <Battery className="w-3.5 h-3.5" />
                          <span>{e.batteryLevel || 80}%</span>
                        </div>
                        <div className="text-slate-400 text-[10px]">{e.totalSubmissions} interviews</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality Alerts & Fraud Detection Feed (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Quality Control Anomaly Stream</h3>
                </div>
                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                  {unresolvedAlerts.length} Unresolved
                </span>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                      alert.resolved
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : alert.severity === 'high'
                        ? 'bg-red-950/20 border-red-500/40 text-red-200'
                        : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            alert.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                        />
                        <span>{alert.enumeratorName}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{alert.timestamp}</span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-300">{alert.message}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        Type: {alert.type}
                      </span>
                      {!alert.resolved ? (
                        <button
                          onClick={() => onResolveAlert(alert.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Mark Resolved</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: FINISHED JOBS & AUDIO QC AUDITS */}
      {viewTab === 'finished_jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Finished Fieldwork Jobs & Supervisor Inspection</h2>
              <p className="text-xs text-slate-400">
                Click any finished job to inspect audio audit recordings, GPS cluster validation, and approve or flag.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              {submissions.length} Total Submissions Synced
            </div>
          </div>

          <div className="divide-y divide-slate-800/60 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wider text-[10px] font-bold pb-2">
                  <th className="py-2.5 px-3">Instance / Form</th>
                  <th className="py-2.5 px-3">Interviewer</th>
                  <th className="py-2.5 px-3">State & Cluster</th>
                  <th className="py-2.5 px-3">Duration & GPS</th>
                  <th className="py-2.5 px-3">Audios</th>
                  <th className="py-2.5 px-3">QC Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {submissions.map((sub) => {
                  const hasGps = sub.metadata?.latitude && sub.metadata?.longitude;
                  const isApproved = sub.status === 'approved';
                  const isFlagged = sub.status === 'flagged';
                  return (
                    <tr key={sub.instanceId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{sub.formTitle}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                          {sub.instanceId}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{sub.enumeratorName}</div>
                        <div className="text-[10px] text-slate-400">
                          Sup: {sub.supervisorName || 'James Edwin'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-200 block">{sub.locationState || 'Lagos'}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                          {sub.sector || 'Mainland Central'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div>{sub.metadata?.durationSeconds || 450}s</div>
                        <div className={hasGps ? 'text-emerald-400 text-[10px]' : 'text-slate-500 text-[10px]'}>
                          {hasGps ? `GPS ±${sub.metadata?.accuracy || 3.5}m` : 'No GPS Fix'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {sub.audios ? (
                          <div className="flex items-center gap-1 text-purple-400 font-mono text-[10px]">
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>rec_1, 2, 3</span>
                          </div>
                        ) : sub.metadata?.audioAuditRecorded ? (
                          <span className="text-purple-400 text-[10px]">1 QA Audio</span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">None</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            isApproved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isFlagged
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyReviewLink(sub.instanceId)}
                            title="Copy Secure Job Review Link"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenJobReview(sub)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Job</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: VIRTUAL WATCH LIVE (REAL-TIME FIELD MONITOR) */}
      {viewTab === 'virtual_watch_live' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h2 className="text-base font-bold text-white">Live Enumerator Telemetry Stream</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Watch live fieldwork as questions are answered in real-time. Consent-based remote video audits.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-3 py-1.5 rounded-xl font-mono">
                <Radio className="w-4 h-4 animate-spin" />
                <span>3 Active Field Sessions Streaming</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {liveSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 relative hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-white text-xs">{session.enumeratorName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                      {session.deviceId}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="text-slate-300">{session.locationName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Battery & Signal:</span>
                      <span className="text-emerald-400">{session.batteryLevel}% • {session.networkSignal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Elapsed Time:</span>
                      <span className="text-blue-400">{Math.floor(session.interviewElapsedSeconds / 60)}m {session.interviewElapsedSeconds % 60}s</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                    <span className="text-[9px] uppercase font-bold text-red-400 block tracking-wider">
                      Currently Answering:
                    </span>
                    <p className="text-[11px] text-white font-medium line-clamp-2">
                      {session.currentQuestionLabel}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-purple-400 font-mono">
                      <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                      <span>QA Audio Active</span>
                    </div>

                    <button
                      onClick={() => handleInitiateLiveMonitor(session)}
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow"
                    >
                      <Video className="w-3 h-3" />
                      <span>Remote QC Camera</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FINISHED JOB DETAILED AUDIT CONSOLE */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedJob.formTitle}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {selectedJob.status.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedJob.instanceId}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyReviewLink(selectedJob.instanceId)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Share Link</span>
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Access Code Check if not authorized */}
              {!isAccessGranted ? (
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-3">
                  <Lock className="w-8 h-8 text-amber-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Supervisor Access Code Verification Required</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Please provide an authorized supervisor access code (e.g., enum_02, sup_01, admin) to inspect this fieldwork job.
                  </p>
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                    <input
                      type="text"
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value)}
                      placeholder="Access Code"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleVerifyAccessCode}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Metadata & Surveyor Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Interviewer</span>
                      <span className="font-bold text-white block mt-0.5">{selectedJob.enumeratorName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {selectedJob.enumeratorId}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Supervisor</span>
                      <span className="font-bold text-white block mt-0.5">
                        {selectedJob.supervisorName || 'James Edwin'}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">QC Assigned</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">State & Sector</span>
                      <span className="font-bold text-white block mt-0.5">{selectedJob.locationState || 'Lagos'}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{selectedJob.sector || 'Mainland'}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Timing</span>
                      <span className="font-mono text-white block mt-0.5">{selectedJob.metadata?.durationSeconds || 500} seconds</span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(selectedJob.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Audio Audit Player Section (rec_1, rec_2, rec_3) */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <Volume2 className="w-4 h-4 text-purple-400" />
                        <span>Enumerator Audio Audits (Quality Control Verification)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                        <span>Speed:</span>
                        {[1.0, 1.25, 1.5, 2.0].map((s) => (
                          <button
                            key={s}
                            onClick={() => setAudioPlaybackSpeed(s)}
                            className={`px-1.5 py-0.5 rounded ${
                              audioPlaybackSpeed === s ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:text-white'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { key: 'rec_1', label: 'rec_1: Consent & Intro', desc: 'Verbal consent & respondent demographic verification' },
                        { key: 'rec_2', label: 'rec_2: Awareness & Usage', desc: 'Callerfeel usage questions & feature feedback' },
                        { key: 'rec_3', label: 'rec_3: Pricing & Closing', desc: 'Pricing elasticity and final audit sign-off' },
                      ].map((track) => {
                        const isPlaying = playingTrack === track.key;
                        return (
                          <div
                            key={track.key}
                            className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{track.label}</span>
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                94% Clarity
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{track.desc}</p>
                            <button
                              onClick={() => handleTogglePlayAudio(track.key)}
                              className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                isPlaying
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white'
                              }`}
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              <span>{isPlaying ? 'Playing Audio QA...' : 'Play Audit Audio'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Satellite Geopoint & Accuracy Telemetry */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span>GPS Satellite Telemetry & Geofence Verification</span>
                      </div>
                      <span className="text-emerald-400 font-mono text-[11px]">Verified In Target Cluster</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Latitude</span>
                        {selectedJob.metadata?.latitude?.toFixed(5) || '11.98450'}° N
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Longitude</span>
                        {selectedJob.metadata?.longitude?.toFixed(5) || '8.52830'}° E
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Altitude</span>
                        {selectedJob.metadata?.altitude || 482} meters
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Satellite Accuracy</span>
                        ±{selectedJob.metadata?.accuracy || 3.2} meters
                      </div>
                    </div>
                  </div>

                  {/* Respondent Answers & Demographics */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Questionnaire Responses (Project Callerfeel & LSM Profiling):
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedJob.answers || {}).map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">{k}</span>
                          <span className="text-white font-medium block">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supervisor Decision Console */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Supervisor Quality Control Decision:
                    </h4>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setReviewDecision('approved')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                          reviewDecision === 'approved'
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Certify</span>
                      </button>

                      <button
                        onClick={() => setReviewDecision('flagged')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                          reviewDecision === 'flagged'
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Flag for Revision</span>
                      </button>

                      <button
                        onClick={() => setReviewDecision('rejected')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                          reviewDecision === 'rejected'
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>Reject Submission</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Supervisor Audit Notes & Instructions:
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add verification notes, audio quality remarks, or field follow-up instructions..."
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-red-500"
                      />
                    </div>

                    <button
                      onClick={handleSaveJobDecision}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow"
                    >
                      Save & Apply QC Sign-Off
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WEBRTC LIVE REMOTE VIDEO QC INSPECTION */}
      {activeLiveSession && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold text-white">
                  Live Remote QC Video Inspection: {activeLiveSession.enumeratorName}
                </h3>
              </div>
              <button
                onClick={handleCloseLiveMonitor}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {webrtcStatus === 'requesting_consent' ? (
                <div className="py-12 text-center space-y-3">
                  <Camera className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
                  <h4 className="text-sm font-bold text-white">
                    Requesting Consent on Surveyor's Tablet...
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    In compliance with CMRG field privacy protocol, camera inspection requires transparent, verbal and UI approval from enumerator {activeLiveSession.enumeratorName}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Viewport */}
                  <div className="w-full h-64 bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-10" />
                    
                    {/* Simulated live visual frame */}
                    <div className="text-center space-y-2 z-20">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                        <Camera className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="text-xs font-bold text-white">
                        Live WebRTC Video Stream Active
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        Peer-to-Peer 720p @ 30fps • Bitrate: 1.4 Mbps • Latency: 42ms
                      </div>
                    </div>

                    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-white">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span>LIVE REMOTE QC</span>
                    </div>

                    <div className="absolute bottom-3 left-3 z-20 text-[10px] font-mono text-slate-300">
                      Device: {activeLiveSession.deviceId} • Sector: {activeLiveSession.locationName}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-slate-400 font-mono">Audio VU Meter: 94% Speech Clarity</span>
                    <button
                      onClick={handleCloseLiveMonitor}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                    >
                      End Monitoring Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
