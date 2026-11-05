import React, { useState } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Smartphone,
  ChevronLeft,
  KeyRound,
  CheckCircle2,
  Building,
  Globe,
  Mail,
  UserPlus,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { signInWithGoogleOAuth } from '../lib/firebase.ts';
import { StorageManager } from '../lib/storage.ts';
import { UserAuthSession, EnterpriseUserRole } from '../types/survey.ts';

interface LoginScreenProps {
  onLoginSuccess: (userRole: EnterpriseUserRole, userName: string, session?: UserAuthSession) => void;
  onNavigateHome: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onNavigateHome,
}) => {
  const [authMode, setAuthMode] = useState<'password' | 'code' | 'register' | 'verify' | 'forgot'>('password');
  
  // Login Form
  const [email, setEmail] = useState('dammyblack88@gmail.com');
  const [password, setPassword] = useState('Password123!');
  
  // Code / PIN Form
  const [accessCode, setAccessCode] = useState('enum_01');
  const [pin, setPin] = useState('1234');
  
  // Registration Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<EnterpriseUserRole>('enumerator');
  const [regOrgName, setRegOrgName] = useState('Communication and Marketing Research Group Limited');

  // Email verification Form
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');

  // Password Reset Form
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStage, setResetStage] = useState<'request' | 'submit'>('request');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOrgRequest, setShowOrgRequest] = useState(false);

  // 1. Password Login
  // Offline-First Enterprise User Credentials Directory
  const OFFLINE_ENTERPRISE_USERS = [
    {
      userId: 'usr_platform_admin',
      email: 'dammyblack88@gmail.com',
      displayName: 'Dr. Damilare Afolabi (CMRG Director)',
      role: 'platform_admin' as const,
      password: 'Password123!',
      accessCode: 'admin',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
      permissions: ['submissions:create', 'submissions:read', 'submissions:review', 'forms:read', 'forms:create', 'situation:read'],
    },
    {
      userId: 'usr_org_admin',
      email: 'orgadmin@cmrg.org',
      displayName: 'Samuel Korede (Field Operations Lead)',
      role: 'org_admin' as const,
      password: 'Password123!',
      accessCode: 'org_admin',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
      permissions: ['submissions:create', 'submissions:read', 'submissions:review', 'forms:read', 'forms:create', 'situation:read'],
    },
    {
      userId: 'usr_supervisor',
      email: 'supervisor@cmrg.org',
      displayName: 'Amina Bello (Field Supervisor)',
      role: 'supervisor' as const,
      password: 'Password123!',
      accessCode: 'enum_02',
      pin: '1234',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01', 'prj_02'],
      permissions: ['submissions:create', 'submissions:read', 'submissions:review', 'forms:read', 'situation:read'],
    },
    {
      userId: 'usr_supervisor_james',
      email: 'j.edwin@cmrg.org',
      displayName: 'James Edwin (Field Supervisor)',
      role: 'supervisor' as const,
      password: 'Password123!',
      accessCode: 'sup_01',
      pin: '1234',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01'],
      permissions: ['submissions:create', 'submissions:read', 'submissions:review', 'forms:read', 'situation:read'],
    },
    {
      userId: 'usr_enumerator_kwame',
      email: 'enumerator@cmrg.org',
      displayName: 'Kwame Asante (Field Enumerator)',
      role: 'enumerator' as const,
      password: 'Password123!',
      accessCode: 'enum_01',
      pin: '1234',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01'],
      permissions: ['submissions:create', 'submissions:read', 'forms:read'],
    },
    {
      userId: 'usr_enumerator_nancy',
      email: 'n.noble@field.cmrg.org',
      displayName: 'Nancy Noble (Field Enumerator - Kano)',
      role: 'enumerator' as const,
      password: 'Password123!',
      accessCode: 'CM500012',
      pin: '1234',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01'],
      permissions: ['submissions:create', 'submissions:read', 'forms:read'],
    },
    {
      userId: 'usr_analyst',
      email: 'analyst@cmrg.org',
      displayName: 'Sixtus O. (Senior Data Analyst)',
      role: 'data_analyst' as const,
      password: 'Password123!',
      accessCode: 'analyst',
      orgId: 'org_cmrg',
      orgName: 'Communication and Marketing Research Group Limited',
      assignedProjectIds: ['prj_01', 'prj_02', 'prj_03'],
      permissions: ['submissions:read', 'forms:read', 'situation:read'],
    },
  ];

  // 1. Password Login (Serverless API with Resilient Offline Handshake Fallback)
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      let serverAuthSucceeded = false;
      let session: UserAuthSession | null = null;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.user) {
            session = {
              userId: data.user.userId,
              email: data.user.email,
              displayName: data.user.displayName,
              role: data.user.role,
              orgId: data.user.orgId,
              orgName: data.user.orgName,
              authMethod: 'password',
              token: data.token,
              loginAt: data.user.loginAt,
              permissions: data.user.permissions,
              assignedProjectIds: data.user.assignedProjectIds,
            };
            serverAuthSucceeded = true;
          } else if (!res.ok) {
            throw new Error(data.error || 'Authentication rejected by CMRG server.');
          }
        }
      } catch (networkOrParseErr: any) {
        // If server responded with a specific error message, throw it
        if (networkOrParseErr.message && !networkOrParseErr.message.includes('JSON')) {
          throw networkOrParseErr;
        }
      }

      // Offline-first Handshake fallback
      if (!serverAuthSucceeded) {
        const match = OFFLINE_ENTERPRISE_USERS.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
        );
        if (match) {
          session = {
            userId: match.userId,
            email: match.email,
            displayName: match.displayName,
            role: match.role,
            orgId: match.orgId,
            orgName: match.orgName,
            authMethod: 'password',
            token: `cmrg_local_token_${Date.now()}`,
            loginAt: new Date().toISOString(),
            permissions: match.permissions,
            assignedProjectIds: match.assignedProjectIds,
          };
        } else {
          throw new Error('Invalid email or password. Please verify credentials or use 1-click test access.');
        }
      }

      if (session) {
        StorageManager.saveAuthSession(session);
        onLoginSuccess(session.role, session.displayName, session);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Field Access Code / PIN Sign-In (For offline field tablet collectors)
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      let codeAuthSucceeded = false;
      let session: UserAuthSession | null = null;
      const normalizedCode = accessCode.trim().toLowerCase();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode: normalizedCode, pin, authMethod: 'access_code' }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.user) {
            session = {
              userId: data.user.userId,
              email: data.user.email,
              displayName: data.user.displayName,
              role: data.user.role,
              orgId: data.user.orgId,
              orgName: data.user.orgName,
              authMethod: 'access_code',
              token: data.token,
              loginAt: data.user.loginAt,
              permissions: data.user.permissions,
              assignedProjectIds: data.user.assignedProjectIds,
            };
            codeAuthSucceeded = true;
          } else if (!res.ok) {
            throw new Error(data.error || 'Access denied for this enumerator code.');
          }
        }
      } catch (netErr: any) {
        if (netErr.message && !netErr.message.includes('JSON')) {
          throw netErr;
        }
      }

      // Offline-first Code fallback
      if (!codeAuthSucceeded) {
        const match = OFFLINE_ENTERPRISE_USERS.find(
          (u) => u.accessCode.toLowerCase() === normalizedCode && (!pin || !u.pin || u.pin === pin)
        );
        if (match) {
          session = {
            userId: match.userId,
            email: match.email,
            displayName: match.displayName,
            role: match.role,
            orgId: match.orgId,
            orgName: match.orgName,
            authMethod: 'access_code',
            token: `cmrg_local_token_${Date.now()}`,
            loginAt: new Date().toISOString(),
            permissions: match.permissions,
            assignedProjectIds: match.assignedProjectIds,
          };
        } else {
          throw new Error(`Invalid access code "${accessCode}". Check field deployment sheet.`);
        }
      }

      if (session) {
        StorageManager.saveAuthSession(session);
        onLoginSuccess(session.role, session.displayName, session);
      }
    } catch (err: any) {
      setError(err.message || 'Field access verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          orgName: regOrgName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccessMsg(`Account created successfully! Verification token: ${data.verificationToken}`);
      setVerifyToken(data.verificationToken || '');
      setVerifyEmail(regEmail);
      setAuthMode('verify');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Email Verification
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken, email: verifyEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      setSuccessMsg('Email verified successfully! You may now sign in.');
      setEmail(verifyEmail);
      setAuthMode('password');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification token.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Password Reset Request
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      setSuccessMsg(`If registered, a reset authorization token was generated.`);
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setResetStage('submit');
      }
    } catch (err: any) {
      setError(err.message || 'Password reset request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Complete Password Reset
  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }

      setSuccessMsg('Password changed successfully! You can now log in.');
      setEmail(forgotEmail);
      setAuthMode('password');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Google OAuth 2.0 Sign-In
  const handleOAuthSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const session = await signInWithGoogleOAuth('dammyblack88@gmail.com');
      StorageManager.saveAuthSession(session);
      onLoginSuccess(session.role, session.displayName, session);
    } catch (err: any) {
      setError(err.message || 'OAuth 2.0 verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans selection:bg-red-600 selection:text-white">
      {/* Top Header */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4 text-red-500" />
          <span>Back to Landing Page</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-md shadow-red-900/40">
            C
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block leading-none">
              CMRG DATA COLLECT
            </span>
            <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">
              Identity & Access Management
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {authMode === 'password' && 'CMRG Enterprise Sign-In'}
              {authMode === 'code' && 'Field Officer Device Sign-In'}
              {authMode === 'register' && 'New User & Organization Registration'}
              {authMode === 'verify' && 'Verify Account Email'}
              {authMode === 'forgot' && 'Reset Platform Password'}
            </h1>
            <p className="text-xs text-slate-400">
              Role-Based Access Control enforcing field integrity, data isolation, and audit tracking.
            </p>
          </div>

          {/* Navigation Mode Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(null); }}
              className={`py-2 px-2 rounded-lg transition text-center ${
                authMode === 'password' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('code'); setError(null); }}
              className={`py-2 px-2 rounded-lg transition text-center ${
                authMode === 'code' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Access Code
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setError(null); }}
              className={`py-2 px-2 rounded-lg transition text-center ${
                authMode === 'register' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: Standard Password Sign-In */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@cmrg.org"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setError(null); setSuccessMsg(null); }}
                    className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                {isLoading ? (
                  <span>Authenticating Session...</span>
                ) : (
                  <>
                    <span>Sign In to Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider">Or</span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleOAuthSignIn}
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2.5"
              >
                <Globe className="w-4 h-4 text-red-500" />
                <span>Sign In with Institutional OAuth 2.0</span>
              </button>
            </form>
          )}

          {/* MODE 2: Field Access Code & PIN (For field survey tablets) */}
          {authMode === 'code' && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-red-500" />
                  <span>Field Officer Terminal Sign-In</span>
                </div>
                <span>Enter your administrator-issued enumerator ID and 4-digit security PIN.</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Enumerator ID / Device Access Code
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="e.g. enum_01"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Security PIN
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="1234"
                    maxLength={6}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                {isLoading ? (
                  <span>Verifying Device Credentials...</span>
                ) : (
                  <>
                    <span>Launch Field App</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE 3: User Registration */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Samuel Korede"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Corporate / Research Email
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="user@cmrg.org"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Password (Min 8 Characters)
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Requested System Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as EnterpriseUserRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-500"
                >
                  <option value="enumerator">Enumerator (Field Data Collection)</option>
                  <option value="supervisor">Field Supervisor (Review & Situation GIS)</option>
                  <option value="data_analyst">Data Analyst (Analytics & Export)</option>
                  <option value="org_admin">Organization Administrator</option>
                  <option value="platform_admin">Platform Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder="Communication and Marketing Research Group Limited"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                {isLoading ? (
                  <span>Registering Account...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE 4: Email Verification */}
          {authMode === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <span>Enter the authorization token dispatched during account registration to activate your account.</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Registered Email
                </label>
                <input
                  type="email"
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  placeholder="name@cmrg.org"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Verification Token
                </label>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="verify_..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify & Activate Account</span>
              </button>
            </form>
          )}

          {/* MODE 5: Password Reset */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              {resetStage === 'request' ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Account Email
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="user@cmrg.org"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow"
                  >
                    <span>Request Password Reset Token</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Reset Authorization Token
                    </label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="reset_..."
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      New Password (Min 8 Characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow"
                  >
                    <span>Set New Password & Sign In</span>
                  </button>
                </form>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Return to sign in
                </button>
              </div>
            </div>
          )}

          {/* Quick-Click Verified Role Profiles */}
          <div className="pt-3 border-t border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Verified Role Credentials (1-Click Test Access):
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setEmail('dammyblack88@gmail.com');
                  setPassword('Password123!');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-left hover:border-red-500 transition"
              >
                <div className="font-bold text-white">Dr. Damilare Afolabi</div>
                <div className="text-[10px] text-red-400 font-mono">Platform Admin</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setEmail('orgadmin@cmrg.org');
                  setPassword('Password123!');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-left hover:border-red-500 transition"
              >
                <div className="font-bold text-white">Samuel Korede</div>
                <div className="text-[10px] text-blue-400 font-mono">Org Administrator</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setEmail('supervisor@cmrg.org');
                  setPassword('Password123!');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-left hover:border-red-500 transition"
              >
                <div className="font-bold text-white">Amina Bello</div>
                <div className="text-[10px] text-emerald-400 font-mono">Field Supervisor</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('code');
                  setAccessCode('enum_01');
                  setPin('1234');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-left hover:border-red-500 transition"
              >
                <div className="font-bold text-white">Kwame Asante</div>
                <div className="text-[10px] text-amber-400 font-mono">Enumerator (enum_01)</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setEmail('analyst@cmrg.org');
                  setPassword('Password123!');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-left hover:border-red-500 transition"
              >
                <div className="font-bold text-white">Sixtus O.</div>
                <div className="text-[10px] text-purple-400 font-mono">Data Analyst</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('code');
                  setAccessCode('enum_deactivated');
                  setPin('1234');
                }}
                className="p-2 rounded-lg bg-slate-950 border border-red-950 text-left hover:border-red-800 transition"
              >
                <div className="font-bold text-red-300">Suspended Officer</div>
                <div className="text-[10px] text-red-500 font-mono">Deactivated Account</div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-900">
        CMRG Data Collect &bull; Enterprise Research Platform &bull; Role-Based Access Control &bull; © 2026 Communication & Marketing Research Group
      </footer>
    </div>
  );
};
