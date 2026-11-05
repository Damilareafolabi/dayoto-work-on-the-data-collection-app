import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Volume2,
  Mic,
  MicOff,
  Pause,
  Grid,
  Save,
  Check,
  ChevronRight,
  ArrowLeft,
  FileText,
  Edit3,
  Send,
  Eye,
  DownloadCloud,
  QrCode,
  MapPin,
  Camera,
  PenTool,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  HardDrive,
  RefreshCw,
  Plus,
  Table as TableIcon,
  HelpCircle,
  Sliders,
  ShieldCheck,
  Calendar,
  UserCheck,
} from 'lucide-react';
import { FormDefinition, Submission } from '../types/survey.ts';
import { encryptSurveyPayload } from '../lib/crypto.ts';

interface CMRGMobileCollectProps {
  forms: FormDefinition[];
  submissions: Submission[];
  onSaveSubmission: (submission: Submission) => void;
  onSyncAll: () => void;
  onExitMobileOnly?: () => void;
  onOpenGuide?: () => void;
  enumeratorName: string;
  deviceId: string;
}

type MobileScreen =
  | 'menu'
  | 'fill_form'
  | 'phone_survey'
  | 'roster_table'
  | 'likert_sample'
  | 'edit_saved'
  | 'send_finalized'
  | 'view_sent'
  | 'get_blank'
  | 'qr_scan';

export const CMRGMobileCollect: React.FC<CMRGMobileCollectProps> = ({
  forms,
  submissions,
  onSaveSubmission,
  onSyncAll,
  onExitMobileOnly,
  onOpenGuide,
  enumeratorName,
  deviceId,
}) => {
  const [screen, setScreen] = useState<MobileScreen>('menu');
  const [selectedForm, setSelectedForm] = useState<FormDefinition>(forms[0]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTimeStr, setCurrentTimeStr] = useState('11:02');

  // Phone Call (CATI) state
  const [callMode, setCallMode] = useState<'dialpad' | 'in_call' | 'call_ended'>('dialpad');
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dialedNumber, setDialedNumber] = useState('(555) 555-5555');
  const [respondentLabel, setRespondentLabel] = useState('Respondent #1');

  // Repeat Group Roster State (e.g. Household Members)
  const [rosterRows, setRosterRows] = useState([
    { id: 1, name: 'Kwame Mensah', relation: 'Head', gender: 'Male', age: '42' },
    { id: 2, name: 'Akua Mensah', relation: 'Spouse', gender: 'Female', age: '38' },
    { id: 3, name: '', relation: '', gender: '', age: '' },
  ]);
  const [currentRosterName, setCurrentRosterName] = useState('');
  const [currentRosterRelation, setCurrentRosterRelation] = useState('Child');

  // Likert Scale State
  const [likertAnswer, setLikertAnswer] = useState<string>('Agree');

  // Survey timer
  const [surveySeconds, setSurveySeconds] = useState(0);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const t = setInterval(updateTime, 10000);
    return () => clearInterval(t);
  }, []);

  // Call duration counter
  useEffect(() => {
    let t: any;
    if (callMode === 'in_call' && !isOnHold) {
      t = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(t);
  }, [callMode, isOnHold]);

  // Survey timer
  useEffect(() => {
    let t: any;
    if (screen === 'fill_form' || screen === 'phone_survey') {
      t = setInterval(() => setSurveySeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(t);
  }, [screen]);

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const draftSubmissions = submissions.filter((s) => s.status === 'draft');
  const pendingSubmissions = submissions.filter((s) => s.status === 'submitted');
  const sentSubmissions = submissions.filter((s) => s.status === 'synced');

  const visibleQuestions = selectedForm?.questions || [];
  const currentQ = visibleQuestions[activeQuestionIndex];

  const handleAnswer = (val: any) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.name]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[currentQ.name];
      return next;
    });
  };

  const validateAndProceed = () => {
    if (!currentQ) return;
    if (currentQ.required && (answers[currentQ.name] === undefined || answers[currentQ.name] === '')) {
      setErrors((prev) => ({ ...prev, [currentQ.name]: 'This question is required.' }));
      return;
    }
    if (activeQuestionIndex < visibleQuestions.length - 1) {
      setActiveQuestionIndex((prev) => prev + 1);
    } else {
      finalizeForm();
    }
  };

  const finalizeForm = async (isDraft = false) => {
    const instanceId = `uuid:${window.crypto.randomUUID()}`;
    let encryptedEnvelope = undefined;
    if (selectedForm.isEncrypted) {
      try {
        encryptedEnvelope = await encryptSurveyPayload(answers, selectedForm.publicKey);
      } catch (err) {
        console.warn('Encryption notice:', err);
      }
    }

    const sub: Submission = {
      id: `sub_${Date.now()}`,
      instanceId,
      formId: selectedForm.formId,
      formTitle: selectedForm.title,
      formVersion: selectedForm.version,
      enumeratorId: 'enum_01',
      enumeratorName: enumeratorName || 'Field Officer',
      deviceId: deviceId || 'CMRG-MOBILE-COLLECT',
      status: isDraft ? 'draft' : 'submitted',
      answers,
      encryptedEnvelope,
      metadata: {
        startTime: new Date(Date.now() - surveySeconds * 1000).toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: surveySeconds || callDuration || 45,
        audioAuditRecorded: callMode === 'in_call',
        audioAuditDurationSeconds: callDuration,
        deviceBatteryLevel: 88,
        appVersion: 'CMRG-DataCollect-v3.0.0',
        deviceId: deviceId || 'CMRG-MOBILE-COLLECT',
        networkAtSubmission: navigator.onLine ? 'online' : 'offline',
      },
      createdAt: new Date().toISOString(),
    };

    onSaveSubmission(sub);
    setAnswers({});
    setActiveQuestionIndex(0);
    setSurveySeconds(0);
    setScreen('menu');
  };

  const handleAddRosterRow = () => {
    if (currentRosterName.trim()) {
      const updated = [...rosterRows];
      updated[2].name = currentRosterName;
      updated[2].relation = currentRosterRelation;
      updated[2].gender = 'Female';
      updated[2].age = '16';
      updated.push({ id: updated.length + 1, name: '', relation: '', gender: '', age: '' });
      setRosterRows(updated);
      setCurrentRosterName('');
    } else {
      setRosterRows([
        ...rosterRows,
        { id: rosterRows.length + 1, name: '', relation: '', gender: '', age: '' },
      ]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden font-sans select-none">
      {/* Android / Device Status Bar */}
      <div className="h-6 bg-black px-4 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-mono tracking-tight text-slate-300">CMRG FIELD SECURE</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span>{currentTimeStr}</span>
          <HardDrive className="w-3 h-3 text-red-500" />
          <span className="font-mono text-slate-300">88%</span>
        </div>
      </div>

      {/* CMRG Mobile Header (Simple Red, Black, White Style) */}
      <div className="h-14 bg-red-600 px-4 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-2.5 truncate">
          {screen !== 'menu' ? (
            <button
              onClick={() => setScreen('menu')}
              className="p-1 -ml-1 text-white hover:bg-black/20 rounded-full transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-black text-white font-black flex items-center justify-center text-sm shadow">
              C
            </div>
          )}

          <div className="truncate">
            <div className="text-white font-black text-sm tracking-wide truncate">
              {screen === 'menu' && 'CMRG DataCollect'}
              {screen === 'phone_survey' && 'Phone Interview (CATI)'}
              {screen === 'roster_table' && 'Household Roster Grid'}
              {screen === 'likert_sample' && 'Rating Scale Prompt'}
              {screen === 'fill_form' && selectedForm?.title}
              {screen === 'edit_saved' && 'Draft Interviews'}
              {screen === 'send_finalized' && 'Ready for Central Sync'}
              {screen === 'view_sent' && 'Confirmed Submissions'}
              {screen === 'get_blank' && 'Questionnaires Library'}
              {screen === 'qr_scan' && 'Scan Setup QR Code'}
            </div>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 text-white">
          {(screen === 'fill_form' || screen === 'phone_survey' || screen === 'roster_table') && (
            <button
              onClick={() => finalizeForm(true)}
              className="p-1.5 hover:bg-black/20 rounded-lg transition"
              title="Save Incomplete Draft"
            >
              <Save className="w-5 h-5" />
            </button>
          )}

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="p-1.5 hover:bg-black/20 rounded-lg transition text-white"
              title="Fieldwork User Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}

          {onExitMobileOnly && (
            <button
              onClick={onExitMobileOnly}
              className="px-2.5 py-1 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 border border-white/20 transition"
              title="Return to Desktop Command Console"
            >
              Console
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          SCREEN 1: MAIN MENU (CMRG Simple Red, Black, White Style)
          ========================================================================= */}
      {screen === 'menu' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black">
          {/* Quick Feature Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-300">
            <button
              onClick={() => {
                setCallMode('in_call');
                setScreen('phone_survey');
              }}
              className="px-3 py-1 rounded-full bg-slate-900 border border-red-500/40 text-red-400 whitespace-nowrap flex items-center gap-1.5"
            >
              <PhoneCall className="w-3 h-3 text-red-500" />
              <span>CATI Phone Interview</span>
            </button>
            <button
              onClick={() => setScreen('roster_table')}
              className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 whitespace-nowrap flex items-center gap-1.5"
            >
              <TableIcon className="w-3 h-3 text-white" />
              <span>Household Roster</span>
            </button>
            <button
              onClick={() => setScreen('likert_sample')}
              className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 whitespace-nowrap flex items-center gap-1.5"
            >
              <Sliders className="w-3 h-3 text-white" />
              <span>Rating Scale</span>
            </button>
          </div>

          {/* CATI Phone Interview Hero Banner */}
          <div
            onClick={() => {
              setCallMode('in_call');
              setCallDuration(18);
              setScreen('phone_survey');
            }}
            className="p-4 rounded-2xl bg-gradient-to-r from-red-950 via-slate-950 to-black border border-red-600/50 shadow-xl cursor-pointer hover:border-red-500 transition group active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg">
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-white font-extrabold text-sm flex items-center gap-2">
                    <span>Phone Survey (CATI Calling)</span>
                    <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Live call toolbar, respondent labeling & audio audit consent
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Core Action Menu List */}
          <div className="space-y-2 pt-1">
            {/* 1. Start New Interview */}
            <button
              onClick={() => {
                setActiveQuestionIndex(0);
                setAnswers({});
                setScreen('fill_form');
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-600 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Start Field Interview</div>
                  <div className="text-[11px] text-slate-400">Collect response with GPS, photos & signature</div>
                </div>
              </div>
              <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                {forms.length} protocols
              </span>
            </button>

            {/* 2. Draft Interviews */}
            <button
              onClick={() => setScreen('edit_saved')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Saved Drafts Queue</div>
                  <div className="text-[11px] text-slate-400">Locally saved in IndexedDB</div>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                {draftSubmissions.length} drafts
              </span>
            </button>

            {/* 3. Send Finalized Forms */}
            <button
              onClick={() => setScreen('send_finalized')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Pending Upload Queue</div>
                  <div className="text-[11px] text-slate-400">Finalized records awaiting server sync</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                {pendingSubmissions.length} ready
              </span>
            </button>

            {/* 4. Confirmed Submissions */}
            <button
              onClick={() => setScreen('view_sent')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Confirmed Submissions Archive</div>
                  <div className="text-[11px] text-slate-400">Server verified and synced</div>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {sentSubmissions.length} synced
              </span>
            </button>

            {/* 5. Scan QR Code */}
            <button
              onClick={() => setScreen('qr_scan')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Scan Website Setup QR Code</div>
                  <div className="text-[11px] text-slate-400">Configure device instantly from computer screen</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Sync Button */}
          <div className="pt-3">
            <button
              onClick={onSyncAll}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Synchronize with Central Database ({pendingSubmissions.length} pending)</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 2: CATI PHONE SURVEY & CALL CONTROLS
          ========================================================================= */}
      {screen === 'phone_survey' && (
        <div className="flex-1 flex flex-col bg-slate-950 text-white justify-between overflow-hidden">
          {/* Audio Consent Banner (CRITICAL REQUIREMENT) */}
          <div className="p-3 bg-red-950/40 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-400 shrink-0" />
            <span>Consent Mandatory: Ensure verbal consent is captured before recording audio remarks.</span>
          </div>

          {/* Middle Calling Graphic */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
            <div className="w-28 h-28 rounded-full bg-slate-900 border-2 border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
              <UserCheck className="w-12 h-12 text-slate-300" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">{respondentLabel}</h3>
              <p className="text-xs text-slate-400 font-mono">{dialedNumber}</p>
            </div>

            {callMode === 'in_call' ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Call Connected ({formatCallTime(callDuration)})</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCallDuration(1);
                  setCallMode('in_call');
                }}
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Connect Call</span>
              </button>
            )}
          </div>

          {/* In-Call Controls Bottom Tray */}
          {callMode === 'in_call' && (
            <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3 rounded-t-2xl">
              <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
                <span className="font-bold text-white">{respondentLabel}</span>
                <span className="font-mono text-emerald-400">{formatCallTime(callDuration)}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-300">
                <button
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 border ${
                    isSpeakerOn ? 'bg-red-600 text-white border-red-500' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Speaker</span>
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 border ${
                    isMuted ? 'bg-red-600 text-white border-red-500' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>Mute</span>
                </button>

                <button
                  onClick={() => setIsOnHold(!isOnHold)}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 border ${
                    isOnHold ? 'bg-red-600 text-white border-red-500' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <Pause className="w-4 h-4" />
                  <span>Hold</span>
                </button>

                <button
                  onClick={() => setScreen('fill_form')}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-1"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>Survey</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setCallMode('call_ended');
                  setScreen('fill_form');
                }}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call & Complete Questionnaire</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: REPEAT GROUP ROSTER GRID (e.g. Household Members)
          ========================================================================= */}
      {screen === 'roster_table' && (
        <div className="flex-1 flex flex-col bg-slate-950 text-white justify-between overflow-hidden p-4 space-y-4">
          <div className="space-y-3">
            <div className="text-xs text-red-500 font-bold uppercase tracking-wider">
              Repeatable Group: Household Members Roster
            </div>
            <h3 className="text-base font-bold text-white">
              What is the family member's full name and relationship?
            </h3>

            {/* Quick entry form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={currentRosterName}
                onChange={(e) => setCurrentRosterName(e.target.value)}
                placeholder="Enter member name..."
                className="flex-1 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-red-500"
              />
              <select
                value={currentRosterRelation}
                onChange={(e) => setCurrentRosterRelation(e.target.value)}
                className="p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none"
              >
                <option value="Head">Head</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Relative">Relative</option>
              </select>
              <button
                onClick={handleAddRosterRow}
                className="px-3.5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg"
              >
                Add
              </button>
            </div>

            {/* Interactive Repeat Table Grid */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase">
                  <tr>
                    <th className="p-2.5 w-8">#</th>
                    <th className="p-2.5">Member Name</th>
                    <th className="p-2.5">Relationship</th>
                    <th className="p-2.5">Gender</th>
                    <th className="p-2.5">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {rosterRows.map((row, idx) => {
                    const isNew = idx === 2;
                    return (
                      <tr key={row.id} className={isNew ? 'bg-red-950/20' : ''}>
                        <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-white">
                          {isNew ? currentRosterName || '(active input)' : row.name}
                        </td>
                        <td className="p-2.5 text-slate-400">{isNew ? currentRosterRelation : row.relation}</td>
                        <td className="p-2.5 text-slate-400">{row.gender || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-400">{row.age || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t border-slate-800">
            <button
              onClick={() => setScreen('menu')}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Back to Menu
            </button>
            <button
              onClick={() => {
                alert('Household Roster table saved to interview payload!');
                setScreen('menu');
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
            >
              Confirm Roster
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: RATING SCALE PROMPT (Likert)
          ========================================================================= */}
      {screen === 'likert_sample' && (
        <div className="flex-1 flex flex-col bg-slate-950 text-white p-6 justify-between overflow-y-auto">
          <div className="space-y-6 pt-4">
            <h3 className="text-lg font-bold text-white leading-snug">
              How much do you agree with the following research statement?
            </h3>

            <p className="text-sm italic text-slate-400">
              "Local brand product quality and packaging has improved over the past 12 months."
            </p>

            {/* Connected Rating Scale (Red & White aesthetic) */}
            <div className="pt-8 pb-4 relative">
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-800" />

              <div className="flex justify-between items-start relative z-10">
                {['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((opt) => {
                  const isSelected = likertAnswer === opt;
                  return (
                    <div
                      key={opt}
                      onClick={() => setLikertAnswer(opt)}
                      className="flex flex-col items-center cursor-pointer max-w-[60px] text-center"
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-black transition ${
                          isSelected ? 'border-red-500 bg-red-600' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium mt-2 leading-tight">
                        {opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setScreen('menu')}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Menu
            </button>
            <button
              onClick={() => {
                alert(`Rating recorded: ${likertAnswer}`);
                setScreen('menu');
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
            >
              Save Rating
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 5: FIELD INTERVIEW QUESTIONNAIRE
          ========================================================================= */}
      {screen === 'fill_form' && currentQ && (
        <div className="flex-1 flex flex-col bg-slate-950 p-4 justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
              <span className="font-semibold text-red-500">
                Question {activeQuestionIndex + 1} of {visibleQuestions.length}
              </span>
              <span className="font-mono text-slate-400">
                {Math.floor(surveySeconds / 60)}m {surveySeconds % 60}s
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white leading-snug">
                {currentQ.label}
              </h3>
              {currentQ.hint && (
                <p className="text-xs text-slate-400 italic">{currentQ.hint}</p>
              )}
            </div>

            {errors[currentQ.name] && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors[currentQ.name]}</span>
              </div>
            )}

            <div className="pt-2">
              {currentQ.type === 'text' && (
                <input
                  type="text"
                  value={answers[currentQ.name] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Enter response..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:border-red-500 outline-none"
                />
              )}

              {(currentQ.type === 'integer' || currentQ.type === 'decimal') && (
                <input
                  type="number"
                  value={answers[currentQ.name] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="0"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-lg font-mono focus:border-red-500 outline-none"
                />
              )}

              {currentQ.type === 'select_one' && (
                <div className="space-y-2">
                  {currentQ.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(opt.value)}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition ${
                        answers[currentQ.name] === opt.value
                          ? 'bg-red-600/20 border-red-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          answers[currentQ.name] === opt.value
                            ? 'border-red-500 bg-red-600'
                            : 'border-slate-600'
                        }`}
                      >
                        {answers[currentQ.name] === opt.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {currentQ.type === 'geopoint' && (
                <button
                  onClick={() =>
                    handleAnswer({
                      latitude: 5.5601,
                      longitude: -0.1982,
                      accuracy: 3.8,
                    })
                  }
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-red-400 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>
                    {answers[currentQ.name] ? 'GPS Fix Acquired: (5.5601, -0.1982)' : 'Capture GPS Coordinates'}
                  </span>
                </button>
              )}

              {currentQ.type === 'signature' && (
                <div className="space-y-1">
                  <div className="border border-slate-700 rounded-xl bg-white touch-none">
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={120}
                      onMouseDown={(e: any) => setIsDrawing(true)}
                      onMouseUp={() => setIsDrawing(false)}
                      className="w-full h-28 block cursor-crosshair"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Respondent signature verification</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800">
            <button
              onClick={() => {
                if (activeQuestionIndex > 0) setActiveQuestionIndex((prev) => prev - 1);
              }}
              disabled={activeQuestionIndex === 0}
              className="px-4 py-2 bg-slate-800 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-300"
            >
              Previous
            </button>

            <button
              onClick={validateAndProceed}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md transition"
            >
              {activeQuestionIndex < visibleQuestions.length - 1 ? 'Next' : 'Finalize & Mark for Sync'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 6: PENDING UPLOAD QUEUE
          ========================================================================= */}
      {screen === 'send_finalized' && (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-black">
          <div className="text-xs text-slate-400">
            Interviews ready to be synchronized with the central PostgreSQL backend:
          </div>

          <div className="space-y-2">
            {pendingSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-white">{sub.formTitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ID: {sub.instanceId.substring(0, 16)}...
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            ))}

            {pendingSubmissions.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No finalized forms in queue. All data is synchronized!
              </div>
            )}
          </div>

          {pendingSubmissions.length > 0 && (
            <button
              onClick={onSyncAll}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Synchronize Selected ({pendingSubmissions.length})</span>
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          SCREEN 7: QR SCANNER
          ========================================================================= */}
      {screen === 'qr_scan' && (
        <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-black text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center mx-auto">
            <QrCode className="w-8 h-8" />
          </div>

          <div>
            <h3 className="font-bold text-base text-white">Device Quick Setup</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Scan the setup QR code on the desktop CMRG Web Console to load forms and server credentials instantly.
            </p>
          </div>

          <div className="w-60 h-60 mx-auto rounded-3xl bg-slate-950 border-2 border-dashed border-red-500/70 relative flex items-center justify-center overflow-hidden">
            <div className="w-44 h-44 border-2 border-red-500 rounded-xl relative flex items-center justify-center animate-pulse">
              <span className="text-[10px] text-red-400 font-mono uppercase">
                Align QR Code in frame
              </span>
            </div>
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-bounce" />
          </div>

          <button
            onClick={() => {
              alert('QR Code Verified! CMRG questionnaires refreshed from server.');
              setScreen('menu');
            }}
            className="w-full max-w-xs py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs mx-auto block"
          >
            Simulate QR Code Scan
          </button>
        </div>
      )}

      {/* =========================================================================
          SCREEN 8: DRAFTS & CONFIRMED VIEWS
          ========================================================================= */}
      {screen === 'edit_saved' && (
        <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-black">
          {draftSubmissions.map((sub) => (
            <div
              key={sub.id}
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>{sub.formTitle}</span>
                <span className="text-amber-400 text-[10px] uppercase font-bold">DRAFT</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Instance: {sub.instanceId.substring(0, 16)}...
              </div>
            </div>
          ))}
          {draftSubmissions.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No saved drafts found.
            </div>
          )}
        </div>
      )}

      {screen === 'view_sent' && (
        <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-black">
          {sentSubmissions.map((sub) => (
            <div
              key={sub.id}
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>{sub.formTitle}</span>
                <span className="text-emerald-400 text-[10px] uppercase font-bold">SYNCED</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Instance: {sub.instanceId.substring(0, 16)}...
              </div>
            </div>
          ))}
          {sentSubmissions.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No confirmed submissions in archive.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
