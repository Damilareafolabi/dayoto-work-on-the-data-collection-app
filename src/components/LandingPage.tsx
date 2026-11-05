import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  ShieldCheck,
  MapPin,
  FileText,
  Users,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Wifi,
  WifiOff,
  ExternalLink,
  Lock,
  Layers,
  HelpCircle,
  Activity,
  Server,
  HardDrive,
  Copy,
  Check,
  BarChart3,
  Search,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { SimeonFAQChatbot } from './SimeonFAQChatbot.tsx';

interface LandingPageProps {
  onLaunchCollector: () => void;
  onGoToLogin: () => void;
  onOpenConsole?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchCollector,
  onGoToLogin,
  onOpenConsole,
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://cmrg.field.org';

  const handleOpenConsole = onOpenConsole || onGoToLogin;

  useEffect(() => {
    QRCode.toDataURL(currentUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR code generation notice:', err));
  }, [currentUrl]);

  const handleCopyUrl = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-red-600 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-md shadow-red-900/40">
              C
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm sm:text-base tracking-tight text-white block leading-none">
                  CMRG DATA COLLECT
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                REAL PEOPLE · REAL DATA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowQrModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
              title="Mobile PWA QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-red-500" />
              <span>Mobile QR</span>
            </button>

            <button
              onClick={onLaunchCollector}
              className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition px-2 py-1"
            >
              Field app
            </button>

            <button
              onClick={handleOpenConsole}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs sm:text-sm font-bold text-white transition shadow-md shadow-red-900/30"
            >
              Open console
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section — Matching Screenshot 1 */}
      <section className="relative min-h-[520px] lg:min-h-[600px] flex items-center overflow-hidden bg-slate-950 text-white">
        {/* Background Image: Market trader interviewed by CMRG surveyor */}
        <div
          className="absolute inset-0 bg-cover bg-center lg:bg-right"
          style={{
            backgroundImage: `url('/assets/aistudio/image_9a514a7c.png')`,
          }}
        />

        {/* Gradient Overlay for high-contrast legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 sm:via-slate-950/75 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
          <div className="max-w-2xl space-y-6">
            <div className="text-[11px] sm:text-xs font-black tracking-widest text-red-500 uppercase font-mono">
              COMMUNICATION & MARKETING RESEARCH GROUP
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05]">
              Real people.
              <br />
              Real data.
              <br />
              <span className="text-red-600">Real insights.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              CMRG Data Collect takes a questionnaire from the research desk to the street and back. Enumerators can interview without network coverage, and every answer syncs once the signal returns.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleOpenConsole}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-lg transition shadow-xl shadow-red-900/40"
              >
                <span>Build a questionnaire</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onLaunchCollector}
                className="flex items-center gap-2 px-5 py-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-700 hover:border-slate-500 text-white font-bold text-xs sm:text-sm rounded-lg transition backdrop-blur-sm"
              >
                <Smartphone className="w-4 h-4 text-red-500" />
                <span>Try the field app</span>
              </button>
            </div>
          </div>
        </div>

        {/* Red Accent Strip */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      </section>

      {/* Section 2: The Fieldwork Loop — Matching Screenshot 2 */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                From the research desk to the field and back again.
              </h2>
            </div>
            <div className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">
              THE FIELDWORK LOOP
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Step 01 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">01</div>
              <h3 className="text-base font-black text-slate-900">Build</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Design any questionnaire with codes, skip logic and media questions.
              </p>
            </div>

            {/* Step 02 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">02</div>
              <h3 className="text-base font-black text-slate-900">Assign</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Issue enumerator access codes and push questionnaires to the field.
              </p>
            </div>

            {/* Step 03 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">03</div>
              <h3 className="text-base font-black text-slate-900">Collect</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interview respondents with or without network coverage.
              </p>
            </div>

            {/* Step 04 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">04</div>
              <h3 className="text-base font-black text-slate-900">Sync</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interviews upload automatically the moment signal returns.
              </p>
            </div>

            {/* Step 05 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">05</div>
              <h3 className="text-base font-black text-slate-900">Verify</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Supervisors check GPS, timing and quality in the Situation Room.
              </p>
            </div>

            {/* Step 06 */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white hover:border-red-400 transition hover:shadow-md space-y-2">
              <div className="text-xs font-mono font-bold text-red-600">06</div>
              <h3 className="text-base font-black text-slate-900">Export</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Download coded data to Excel or CSV for analysis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: One Platform for Every Study — Matching Screenshot 2 */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
              One platform for every study.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Customer experience, retail audits, audience measurement, opinion polls. The builder handles any questionnaire design, so a new study needs no new app.
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Role-based access, private media storage and an audit trail for every change.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Questionnaire builder</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Twelve question types, answer codes, variable names, mandatory rules and conditional logic. Draft, preview, publish, duplicate.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Enumerator field app</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                An installable app for Android and iPhone. Enumerators sign in with an access code and see only their assigned projects.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <WifiOff className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Offline-first collection</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Questionnaires, drafts, completed interviews and media are stored on the device until the server confirms they arrived.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Automatic synchronisation</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Unique interview IDs, retry queues and duplicate protection. Clear pending, syncing and synced states.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Situation Room</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Live map of the field team, interview locations, GPS verification, supervisor review and project performance.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950">Response management</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Search, filter and open interviews. Export to Excel and CSV with question codes preserved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audiences: For Researchers & Enumerators */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* For researchers & supervisors */}
            <div className="p-8 rounded-2xl border-2 border-slate-900 bg-white space-y-4">
              <div className="text-xs font-bold text-red-600 uppercase tracking-widest font-mono">
                FOR RESEARCHERS & SUPERVISORS
              </div>
              <h3 className="text-2xl font-black text-slate-950">Research console</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Projects, questionnaires, enumerators and the Situation Room.
              </p>
              <button
                onClick={handleOpenConsole}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-md"
              >
                <span>Open console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* For enumerators */}
            <div className="p-8 rounded-2xl border-2 border-slate-900 bg-white space-y-4">
              <div className="text-xs font-bold text-red-600 uppercase tracking-widest font-mono">
                FOR ENUMERATORS
              </div>
              <h3 className="text-2xl font-black text-slate-950">Field app</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sign in with your access code and start interviewing.
              </p>
              <button
                onClick={onLaunchCollector}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-md"
              >
                <Smartphone className="w-4 h-4 text-red-500" />
                <span>Launch field app</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer & Credits */}
      <footer className="py-12 bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center font-black text-white text-xs">
                  C
                </div>
                <span className="font-black text-base tracking-tight text-white">
                  CMRG DATA COLLECT
                </span>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Real people &middot; Real data
              </div>
            </div>

            <div className="text-xs text-slate-400">
              &copy; 2026 Communication and Marketing Research Group Limited
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1 font-mono">
            <div>
              Built by <strong className="text-slate-300">Afolabi Oluwadamilare Simeon</strong> — Lead Developer, Idea and Strategy, Full-Stack Developer, CEO of SimeonJr Studios.
            </div>
            <div>
              Special contributions and project credits: <strong className="text-slate-400">Samuel Korede</strong> and <strong className="text-slate-400">Sixtus</strong>.
            </div>
          </div>
        </div>
      </footer>

      {/* Real QR Code Modal for Mobile PWA Installation */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center mx-auto">
              <QrCode className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Install on Android or iPhone</h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan with your phone's camera to install the field app directly without an app store.
              </p>
            </div>

            {qrDataUrl && (
              <div className="bg-white p-3 rounded-xl inline-block shadow-inner mx-auto">
                <img src={qrDataUrl} alt="CMRG Field App QR Code" className="w-52 h-52 mx-auto" />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 truncate font-mono text-[11px]">{currentUrl}</span>
              <button
                onClick={handleCopyUrl}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] flex items-center gap-1 transition"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Simeon FAQ Chatbot */}
      <SimeonFAQChatbot />
    </div>
  );
};
