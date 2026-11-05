import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  PhoneCall,
  Table,
  CheckCircle2,
  HardDrive,
  Download,
  WifiOff,
  Radio,
  Database,
  X,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      id: 'pwa_install',
      title: '1. Install as Standalone PWA (No Play Store Needed)',
      badge: 'Zero Play Store Dependency',
      icon: Smartphone,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      description:
        'CMRG DataCollect runs as a native Progressive Web App (PWA) directly from any mobile browser on Android or iOS.',
      bullets: [
        'On Android / Chrome: Tap "Install Mobile PWA" or your browser menu → "Add to Home Screen".',
        'On iPhone / iPad Safari: Tap the Share button → "Add to Home Screen".',
        'Launches in full standalone mode without browser URL bars, exactly like a native APK from the Play Store.',
        '100% offline-ready: Pre-caches all survey scripts, questions, and forms.',
      ],
    },
    {
      id: 'qr_setup',
      title: '2. One-Scan QR Code Configuration',
      badge: 'Instant Setup',
      icon: QrCode,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description:
        'Deploying a field team? Enumerators configure their phone with zero typing using the desktop QR code.',
      bullets: [
        'Open the desktop Web Console → "ODK & settings" or "Forms & imports".',
        'A QR code is generated with the central server URL, RSA encryption keys, and enumerator settings.',
        'On the mobile app, tap "Scan Quick Setup QR Code".',
        'Point the device camera to instantly load questionnaires and cryptographic security certificates.',
      ],
    },
    {
      id: 'phone_surveys',
      title: '3. Phone Surveys (CATI) & Dialer',
      badge: 'CMRG CATI Feature',
      icon: PhoneCall,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      description:
        'Administer computer-assisted telephone interviews with built-in call management and phone number labeling.',
      bullets: [
        'Tap "Phone surveys (CATI)" on the main menu.',
        'Use the built-in Android-style dialpad with numbers 1-9 to call respondents.',
        'In-call toolbar features: live call timer (e.g. 00:27), Speaker, Mute, Hold, and Keypad toggles.',
        'Labels phone numbers by relationship (e.g. "Respondent #1", "Alternate Relative").',
        'Automatic audio audit background logging and call outcome tracking.',
      ],
    },
    {
      id: 'repeated_questions',
      title: '4. Repeat Groups & Table View',
      badge: 'Roster Grid',
      icon: Table,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      description:
        'CMRG table view helps enumerators keep track of their place while answering repeated roster questions.',
      bullets: [
        'Supports household member rosters, asset tables, and brand stock audits.',
        'Displays an interactive table grid with columns (e.g. name, gender, age).',
        'Active row is highlighted in green with quick "+ Add row" button.',
        'Seamlessly switches between question-by-question input and full table overview.',
      ],
    },
    {
      id: 'offline_sync',
      title: '5. Offline Storage & Cryptographic Security',
      badge: 'AES-256 + RSA Keys',
      icon: HardDrive,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description:
        'Work in remote, off-grid areas with complete confidence that your data is safe and tamper-proof.',
      bullets: [
        'Survey responses, GPS fixes, photos, and signatures are persisted locally in device storage.',
        'End-to-End Encryption: Symmetrically encrypted on device with AES-256-GCM before storage.',
        'Auto-Sync with Wi-Fi / Cellular: Uploads finalized submissions automatically when connectivity returns.',
        'Central Vault Decryptor: Decrypt records securely using the CMRG RSA Private Key.',
      ],
    },
    {
      id: 'situation_room',
      title: '6. Field Situation Room & SQL Engine',
      badge: 'Command Center',
      icon: Radio,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description:
        'Supervise fieldwork live, detect interview anomalies, and query results using PostgreSQL.',
      bullets: [
        'Interactive Satellite Map: Track real-time GPS cluster dispersion of field officers.',
        'Speed Audits: Automatic alerts when an interview is finished suspiciously fast (< 120s).',
        'PostgreSQL & PostGIS Schema: Production DDL provided in `src/db/schema.sql`.',
        'SQL Studio: Run live analytical queries directly against survey datasets.',
      ],
    },
  ];

  const current = steps[activeStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700 p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black shadow-lg">
              C
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase">
                CMRG FIELDWORK USER MANUAL
              </div>
              <h2 className="text-xl font-black text-white">
                How to Use CMRG DataCollect & Mobile Field App
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {steps.map((st, idx) => (
            <button
              key={st.id}
              onClick={() => setActiveStep(idx)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-semibold transition ${
                activeStep === idx
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Step {idx + 1}
            </button>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${current.color}`}>
                <current.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{current.title}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {current.badge}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {activeStep + 1} / {steps.length}
            </span>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {current.description}
          </p>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {current.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
            disabled={activeStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-300 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeStep === i ? 'w-6 bg-red-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {activeStep < steps.length - 1 ? (
            <button
              onClick={() => setActiveStep((p) => Math.min(steps.length - 1, p + 1))}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md transition"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md transition"
            >
              <span>Get Started</span>
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
