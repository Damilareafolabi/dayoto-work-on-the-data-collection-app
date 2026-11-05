import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Overview } from './components/Overview.tsx';
import { CapacityUsageDashboard } from './components/CapacityUsageDashboard.tsx';
import { FormsAndImports } from './components/FormsAndImports.tsx';
import { CollectData } from './components/CollectData.tsx';
import { SubmissionsView } from './components/SubmissionsView.tsx';
import { SituationRoom } from './components/SituationRoom.tsx';
import { AdminEnumeratorManager } from './components/AdminEnumeratorManager.tsx';
import { SQLStudio } from './components/SQLStudio.tsx';
import { SystemSettings } from './components/SystemSettings.tsx';
import { CMRGMobileCollect } from './components/CMRGMobileCollect.tsx';
import { UserGuideModal } from './components/UserGuideModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { StorageManager } from './lib/storage.ts';
import { syncSubmissionToCloud, subscribeToCloudSubmissions, signOutUser } from './lib/firebase.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import {
  FormDefinition,
  Submission,
  ODKSettingsConfig,
  SituationAlert,
  EnumeratorProfile,
  UserAuthSession,
  EnterpriseUserRole,
} from './types/survey.ts';
import {
  Monitor,
  WifiOff,
  CheckCircle,
  Building,
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  Globe,
  Sliders,
  Smartphone,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [forms, setForms] = useState<FormDefinition[]>(() => StorageManager.getForms());
  const [submissions, setSubmissions] = useState<Submission[]>(() => StorageManager.getSubmissions());
  const [alerts, setAlerts] = useState<SituationAlert[]>(() => StorageManager.getAlerts());
  const [settings, setSettings] = useState<ODKSettingsConfig>(() => StorageManager.getSettings());
  const [enumerators, setEnumerators] = useState<EnumeratorProfile[]>(() => StorageManager.getEnumerators());

  // User Auth Session
  const [userSession, setUserSession] = useState<UserAuthSession | null>(() => {
    return StorageManager.getAuthSession();
  });

  // Top-Level View State: 'landing' | 'console' | 'mobile_app' | 'login'
  const [viewState, setViewState] = useState<'landing' | 'console' | 'mobile_app' | 'login'>('landing');
  const [collectFormId, setCollectFormId] = useState<string | undefined>();
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const isOnline = useOnlineStatus();

  // If on actual mobile device, default to mobile fieldwork app
  useEffect(() => {
    if (window.innerWidth < 640 && window.location.hash !== '#console') {
      setViewState('mobile_app');
    }
  }, []);

  // Real-time Central Cloud Database Listener
  useEffect(() => {
    if (!isOnline) return;

    const unsubscribe = subscribeToCloudSubmissions((cloudRecords) => {
      if (cloudRecords && cloudRecords.length > 0) {
        setSubmissions((prev) => {
          let updated = [...prev];
          let changed = false;

          for (const cr of cloudRecords) {
            const idx = updated.findIndex((s) => s.id === cr.id || s.instanceId === cr.instanceId);
            if (idx >= 0) {
              if (cr.status && cr.status !== updated[idx].status) {
                updated[idx] = { ...updated[idx], ...cr };
                changed = true;
              }
            } else if (cr.instanceId && cr.formId) {
              updated.unshift(cr as Submission);
              changed = true;
            }
          }

          if (changed) {
            StorageManager.saveSubmissions(updated);
          }
          return changed ? updated : prev;
        });
      }
    });

    return () => unsubscribe();
  }, [isOnline]);

  // Submission persistence
  const handleSaveSubmission = (newSub: Submission) => {
    StorageManager.addSubmission(newSub);
    setSubmissions(StorageManager.getSubmissions());
  };

  const handleAddForm = (newForm: FormDefinition) => {
    const updated = [newForm, ...forms];
    setForms(updated);
    StorageManager.saveForms(updated);
  };

  const handleDeleteForm = (formId: string) => {
    const updated = forms.filter((f) => f.id !== formId);
    setForms(updated);
    StorageManager.saveForms(updated);
  };

  const handleSaveSettings = (newSettings: ODKSettingsConfig) => {
    setSettings(newSettings);
    StorageManager.saveSettings(newSettings);
  };

  const handleResolveAlert = (alertId: string) => {
    const updated = alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a));
    setAlerts(updated);
    StorageManager.saveAlerts(updated);
  };

  // Enumerator Management Actions
  const handleToggleEnumeratorStatus = (enumeratorId: string, active: boolean) => {
    const updated = enumerators.map((e) => (e.id === enumeratorId ? { ...e, active } : e));
    setEnumerators(updated);
    StorageManager.saveEnumerators(updated);
  };

  const handleAddEnumerator = (newProfile: EnumeratorProfile) => {
    const updated = [newProfile, ...enumerators];
    setEnumerators(updated);
    StorageManager.saveEnumerators(updated);
  };

  const handleAssignFormsToEnumerator = (enumeratorId: string, formIds: string[]) => {
    const updatedForms = forms.map((f) => {
      const isAssigned = formIds.includes(f.formId);
      const currentList = f.assignedEnumeratorIds || [];
      const newList = isAssigned
        ? Array.from(new Set([...currentList, enumeratorId]))
        : currentList.filter((id: string) => id !== enumeratorId);
      return { ...f, assignedEnumeratorIds: newList };
    });
    setForms(updatedForms);
    StorageManager.saveForms(updatedForms);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const pending = submissions.filter((s) => s.status === 'submitted' || s.status === 'draft');
    let successCount = 0;

    for (const sub of pending) {
      const ok = await syncSubmissionToCloud(sub);
      if (ok) successCount++;
    }

    const updated = submissions.map((s) => {
      if (s.status === 'submitted' || s.status === 'draft') {
        return { ...s, status: 'synced' as const, syncedAt: new Date().toISOString() };
      }
      return s;
    });

    setSubmissions(updated);
    StorageManager.saveSubmissions(updated);
    setIsSyncing(false);
    setSyncToast(`Successfully synchronized ${successCount} submissions to central server!`);
    setTimeout(() => setSyncToast(null), 3500);
  };

  const handleSignOut = async () => {
    await signOutUser();
    StorageManager.saveAuthSession(null);
    setUserSession(null);
    setViewState('landing');
  };

  const pendingSyncCount = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'draft'
  ).length;

  // VIEW 1: LANDING PAGE
  if (viewState === 'landing') {
    return (
      <LandingPage
        onLaunchCollector={() => setViewState('mobile_app')}
        onGoToLogin={() => setViewState('login')}
        onOpenConsole={() => {
          if (userSession) {
            setViewState('console');
          } else {
            setViewState('login');
          }
        }}
      />
    );
  }

  // VIEW 2: LOGIN SCREEN
  if (viewState === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={(role, name, session) => {
          const sess: UserAuthSession = session || {
            userId: `usr_${Date.now()}`,
            email: `${role}@cmrg.org`,
            displayName: name,
            role,
            authMethod: 'password',
            loginAt: new Date().toISOString(),
          };
          setUserSession(sess);
          StorageManager.saveAuthSession(sess);

          // Route enumerators directly to the mobile field app, researchers/admins to console
          if (role === 'enumerator') {
            setViewState('mobile_app');
          } else {
            setViewState('console');
          }
        }}
        onNavigateHome={() => setViewState('landing')}
      />
    );
  }

  // VIEW 3: MOBILE FIELD APP (CMRG Mobile Collect)
  if (viewState === 'mobile_app') {
    return (
      <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
        {/* Offline Toast Banner */}
        {!isOnline && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-full shadow-2xl">
            <WifiOff className="w-4 h-4" />
            <span>Offline Mode Active — Surveys are stored securely on device</span>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-0 md:p-6 bg-slate-950 overflow-hidden relative">
          {/* Top navigation controls for desktop preview */}
          <div className="hidden md:flex absolute top-4 left-6 z-40 items-center gap-3">
            <button
              onClick={() => setViewState('landing')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold shadow-lg transition"
            >
              <ChevronLeft className="w-4 h-4 text-red-500" />
              <span>Back to Portal</span>
            </button>

            {userSession && userSession.role !== 'enumerator' && (
              <button
                onClick={() => setViewState('console')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold shadow-lg transition"
              >
                <Monitor className="w-4 h-4 text-blue-400" />
                <span>Open Web Console</span>
              </button>
            )}

            <span className="text-xs text-slate-400 font-medium">
              Previewing <strong>CMRG Mobile Fieldwork PWA</strong> (Android & iPhone)
            </span>
          </div>

          {/* Smartphone Simulator */}
          <div className="w-full h-full md:w-[410px] md:h-[840px] md:max-h-[95vh] md:rounded-[46px] md:border-[10px] md:border-slate-800 md:shadow-2xl overflow-hidden flex flex-col relative bg-slate-900">
            <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-800 rounded-full z-40" />

            <CMRGMobileCollect
              forms={forms}
              submissions={submissions}
              onSaveSubmission={handleSaveSubmission}
              onSyncAll={handleTriggerSync}
              onExitMobileOnly={() => setViewState('landing')}
              onOpenGuide={() => setIsGuideOpen(true)}
              enumeratorName={userSession?.displayName || settings.enumeratorName}
              deviceId={settings.deviceId}
            />
          </div>
        </div>

        <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </div>
    );
  }

  // VIEW 4: WEB CONSOLE & SITUATION ROOM
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Offline Toast Banner */}
      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-full shadow-2xl">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode Active — Central synchronization paused</span>
        </div>
      )}

      {/* Sync Notification Toast */}
      {syncToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{syncToast}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'collect') {
              setCollectFormId(undefined);
            }
            setCurrentTab(tab);
          }}
          isMobileDeviceView={false}
          onToggleMobileView={() => setViewState('mobile_app')}
          onOpenGuide={() => setIsGuideOpen(true)}
          submissionsCount={submissions.length}
          pendingSyncCount={pendingSyncCount}
          currentUserRole={userSession?.role || 'platform_admin'}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Status & Role Header */}
          <header className="h-14 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState('landing')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-semibold transition"
                title="Return to Welcome Portal"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">Portal Home</span>
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">
                <Building className="w-3 h-3" />
                <span>CMRG RESEARCH OPS</span>
              </div>

              <div className="hidden md:block text-xs text-slate-400">
                Organization: <strong className="text-white">{userSession?.orgName || 'CMRG Operations'}</strong>
              </div>
            </div>

            {/* User Session & Role Indicator */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState('mobile_app')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">Field App</span>
              </button>

              {userSession ? (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 py-1 px-3 rounded-full text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-white truncate max-w-[150px]">
                    {userSession.displayName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-red-600 text-white font-mono">
                    {userSession.role.replace('_', ' ')}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="ml-1 text-slate-400 hover:text-white p-0.5"
                    title="Sign Out / Switch Profile"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setViewState('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {currentTab === 'overview' && (
              <Overview
                onStartCollecting={() => {
                  setCollectFormId(forms[0]?.formId);
                  setCurrentTab('collect');
                }}
                onNavigateToForms={() => setCurrentTab('forms')}
                onNavigateToSubmissions={() => setCurrentTab('submissions')}
                onNavigateToSituation={() => setCurrentTab('situation')}
                onTriggerSync={handleTriggerSync}
                submissions={submissions}
                forms={forms}
                isSyncing={isSyncing}
              />
            )}

            {currentTab === 'capacity' && (
              <CapacityUsageDashboard
                onNavigateToSubmissions={() => setCurrentTab('submissions')}
                onNavigateToSituation={() => setCurrentTab('situation')}
                currentUserRole={userSession?.role || 'platform_admin'}
                currentUserName={userSession?.displayName || 'CMRG Administrator'}
              />
            )}

            {currentTab === 'forms' && (
              <FormsAndImports
                forms={forms}
                onAddForm={handleAddForm}
                onDeleteForm={handleDeleteForm}
                onSelectFormToCollect={(fId) => {
                  setCollectFormId(fId);
                  setCurrentTab('collect');
                }}
              />
            )}

            {currentTab === 'collect' && (
              <CollectData
                forms={forms}
                selectedFormId={collectFormId}
                onSaveSubmission={handleSaveSubmission}
                onBackToOverview={() => setCurrentTab('overview')}
                enumeratorName={userSession?.displayName || settings.enumeratorName}
                deviceId={settings.deviceId}
              />
            )}

            {currentTab === 'submissions' && (
              <SubmissionsView
                submissions={submissions}
                onTriggerSync={handleTriggerSync}
                isSyncing={isSyncing}
                currentUserRole={userSession?.role || 'platform_admin'}
                currentUserName={userSession?.displayName || 'CMRG Administrator'}
                onSubmissionsUpdated={(updated) => setSubmissions(updated)}
              />
            )}

            {currentTab === 'situation' && (
              <SituationRoom
                enumerators={enumerators}
                submissions={submissions}
                alerts={alerts}
                onResolveAlert={handleResolveAlert}
                onUpdateSubmission={handleSaveSubmission}
              />
            )}

            {currentTab === 'enumerators' && (
              <AdminEnumeratorManager
                enumerators={enumerators}
                forms={forms}
                onToggleStatus={handleToggleEnumeratorStatus}
                onAddEnumerator={handleAddEnumerator}
                onAssignForms={handleAssignFormsToEnumerator}
              />
            )}

            {currentTab === 'sql' && <SQLStudio submissions={submissions} />}

            {currentTab === 'settings' && (
              <SystemSettings settings={settings} onSaveSettings={handleSaveSettings} />
            )}
          </div>
        </main>
      </div>

      {/* Interactive Fieldwork User Guide Modal */}
      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
