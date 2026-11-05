import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  FolderSync,
  Radio,
  Database,
  Settings,
  Smartphone,
  Download,
  HardDrive,
  ShieldCheck,
  BookOpen,
  Users,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { StorageManager } from '../lib/storage.ts';
import { EnterpriseUserRole } from '../types/survey.ts';

export type NavTab =
  | 'overview'
  | 'capacity'
  | 'forms'
  | 'collect'
  | 'submissions'
  | 'situation'
  | 'enumerators'
  | 'sql'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isMobileDeviceView: boolean;
  onToggleMobileView: () => void;
  onOpenGuide: () => void;
  submissionsCount: number;
  pendingSyncCount: number;
  currentUserRole?: EnterpriseUserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileDeviceView,
  onToggleMobileView,
  onOpenGuide,
  submissionsCount: _submissionsCount,
  pendingSyncCount,
  currentUserRole = 'platform_admin',
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [showIosModal, setShowIosModal] = React.useState(false);
  const storage = StorageManager.getStorageEstimate();

  const allowedTabsByRole: Record<string, NavTab[]> = {
    platform_admin: ['overview', 'capacity', 'forms', 'collect', 'submissions', 'situation', 'enumerators', 'sql', 'settings'],
    org_admin: ['overview', 'capacity', 'forms', 'collect', 'submissions', 'situation', 'enumerators', 'settings'],
    supervisor: ['overview', 'collect', 'submissions', 'situation', 'enumerators'],
    data_analyst: ['overview', 'submissions', 'situation', 'sql'],
    enumerator: ['overview', 'collect', 'submissions'],
    admin: ['overview', 'capacity', 'forms', 'collect', 'submissions', 'situation', 'enumerators', 'sql', 'settings'],
  };

  const allowedTabs = allowedTabsByRole[currentUserRole] || allowedTabsByRole.platform_admin;

  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'capacity' as NavTab,
      label: 'Platform Capacity',
      icon: HardDrive,
      badge: 'Admin',
      badgeColor: 'bg-red-950/80 text-red-400 border border-red-600/40 font-mono',
    },
    {
      id: 'forms' as NavTab,
      label: 'Forms & imports',
      icon: FileSpreadsheet,
      badge: '3 forms',
    },
    {
      id: 'collect' as NavTab,
      label: 'Collect data',
      icon: PlusCircle,
      badge: 'Start +',
      highlight: true,
    },
    {
      id: 'submissions' as NavTab,
      label: 'Submissions',
      icon: FolderSync,
      badge: pendingSyncCount > 0 ? `${pendingSyncCount} sync` : null,
      badgeColor: pendingSyncCount > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : undefined,
    },
    {
      id: 'situation' as NavTab,
      label: 'Situation Room',
      icon: Radio,
      badge: 'Live',
      badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
      pulseDot: true,
    },
    {
      id: 'enumerators' as NavTab,
      label: 'Enumerators & Access',
      icon: Users,
      badge: 'Admin',
      badgeColor: 'bg-red-950/60 text-red-300 border border-red-600/40',
    },
    {
      id: 'sql' as NavTab,
      label: 'SQL & Postgres',
      icon: Database,
      badge: 'SQL Engine',
    },
    {
      id: 'settings' as NavTab,
      label: 'System & QR Setup',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Brand Header matching screenshot */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 text-white font-black text-2xl tracking-tighter">
            C
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-wider text-white">
              CMRG
            </div>
            <div className="text-[10px] tracking-widest font-black text-red-500 uppercase">
              DATACOLLECT
            </div>
          </div>
        </div>
        <div className="mt-2 text-[9px] font-semibold text-slate-400 tracking-wider uppercase line-clamp-1">
          COMMUNICATION AND MARKETING RESEARCH GROUP
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          WORKSPACE
        </div>

        {navItems
          .filter((item) => allowedTabs.includes(item.id))
          .map((item) => {
            const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-red-600/15 text-red-400 border border-red-500/30 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-red-500' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.pulseDot && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      item.badgeColor || 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Device & PWA Controls at bottom */}
      <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-950/60">
        {/* Device View Mode Switcher */}
        <button
          onClick={onToggleMobileView}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${
            isMobileDeviceView
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Toggle phone screen simulation vs desktop console"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>Mobile Device Mode</span>
          </div>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              isMobileDeviceView ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {isMobileDeviceView ? 'ACTIVE' : 'OFF'}
          </span>
        </button>

        {/* PWA Install Button */}
        {!isInstalled && isInstallable && (
          <button
            onClick={install}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950/50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Install Mobile PWA
          </button>
        )}

        {isIOS && !isInstalled && (
          <button
            onClick={() => setShowIosModal(true)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            <Download className="w-3 h-3 text-red-400" />
            Install on iPhone / iPad
          </button>
        )}

        {/* Fieldwork User Guide Button */}
        <button
          onClick={onOpenGuide}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Fieldwork User Guide</span>
        </button>

        {/* Device Storage Status matching screenshot */}
        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-medium">Device storage active</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <HardDrive className="w-3 h-3" />
            <span>{storage.usedMB} MB</span>
          </div>
        </div>

        {/* Encryption badge */}
        <div className="flex items-center gap-1 text-[9px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>E2E AES-256 + RSA Keys Verified</span>
        </div>
      </div>

      {/* iOS Install Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-black">
                C
              </div>
              <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed space-y-2">
              To install CMRG DataCollect PWA on iOS without the App Store:
              <br />
              <strong className="text-white">1.</strong> Tap the <strong>Share</strong> icon at the bottom of Safari.
              <br />
              <strong className="text-white">2.</strong> Scroll down and choose <strong>Add to Home Screen</strong>.
              <br />
              <strong className="text-white">3.</strong> Tap <strong>Add</strong>. The app will launch in standalone offline mode!
            </p>
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-5 w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-white border border-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
