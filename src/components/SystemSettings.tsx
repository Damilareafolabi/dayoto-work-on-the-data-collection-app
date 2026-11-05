import React, { useState, useEffect } from 'react';
import {
  Server,
  Lock,
  QrCode,
  Smartphone,
  HardDrive,
  Save,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import { ODKSettingsConfig } from '../types/survey.ts';
import { StorageManager } from '../lib/storage.ts';
import { DEFAULT_CMRG_PUBLIC_KEY, DEFAULT_CMRG_PRIVATE_KEY } from '../lib/crypto.ts';

interface SystemSettingsProps {
  settings: ODKSettingsConfig;
  onSaveSettings: (settings: ODKSettingsConfig) => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<ODKSettingsConfig>(settings);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const storage = StorageManager.getStorageEstimate();

  const currentAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cmrg.research.org';

  useEffect(() => {
    // Generate QR code pointing directly to the website URL for interviewers to scan and install
    QRCode.toDataURL(currentAppUrl, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrCodeDataUrl)
      .catch(console.error);
  }, [currentAppUrl]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-red-500 uppercase">
            COMMUNICATION AND MARKETING RESEARCH GROUP
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            System & Server Synchronization Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure central PostgreSQL backend endpoints, cryptographic keys, and generate website install QR codes for field tablets.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-fade-in">
            <Check className="w-4 h-4" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Form (7 cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* Server Sync Section */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Server className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-white">Central PostgreSQL Backend Endpoint</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Server URL</label>
                <input
                  type="url"
                  value={formData.serverUrl}
                  onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                  placeholder="https://api.cmrg-research.org/api/v2"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Backend Architecture</label>
                  <select
                    value={formData.serverType}
                    onChange={(e: any) => setFormData({ ...formData, serverType: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500"
                  >
                    <option value="CMRG Cloud">CMRG High-Availability Cloud</option>
                    <option value="PostgreSQL Standalone">PostgreSQL Standalone Pool</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Field API Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-bold text-white">Auto-Synchronization</div>
                  <div className="text-[11px] text-slate-400">
                    Automatically upload finalized surveys when cellular or Wi-Fi network is detected
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoSync}
                  onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Device Profile Section */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Smartphone className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-white">Device & Field Officer Identity</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Device ID / Asset Tag</label>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Field Officer</label>
                <input
                  type="text"
                  value={formData.enumeratorName}
                  onChange={(e) => setFormData({ ...formData, enumeratorName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Field Sector / Region</label>
                <input
                  type="text"
                  value={formData.enumeratorRegion}
                  onChange={(e) => setFormData({ ...formData, enumeratorRegion: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Cryptographic Keys Manager */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">End-to-End Cryptographic Keys</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                RSA 2048-bit + AES-256-GCM
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-semibold">CMRG Public Key (For encrypting surveys)</span>
                  <button
                    type="button"
                    onClick={() => copyText(DEFAULT_CMRG_PUBLIC_KEY, 'public')}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedKey === 'public' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'public' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={DEFAULT_CMRG_PUBLIC_KEY}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-mono text-[10px] resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-semibold">CMRG Private Key (For decrypting submissions)</span>
                  <button
                    type="button"
                    onClick={() => copyText(DEFAULT_CMRG_PRIVATE_KEY, 'private')}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedKey === 'private' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'private' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={DEFAULT_CMRG_PRIVATE_KEY}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-mono text-[10px] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-950/60 active:scale-95 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>

        {/* QR Code Installation Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Scan to Install Mobile PWA</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Interviewers scan this QR code on their smartphone (Chrome or Safari) to immediately open and tap <strong>"Install / Add to Home Screen"</strong> without any app store.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto">
              <img src={qrCodeDataUrl} alt="CMRG Install QR Code" className="w-48 h-48 mx-auto" />
            </div>

            <div className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800 truncate">
              {currentAppUrl}
            </div>
          </div>

          {/* Storage Quota Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Offline Device Storage</span>
              </div>
              <span className="font-mono text-emerald-400 font-semibold">
                {storage.usedMB} MB / {storage.quotaMB} MB
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2 transition-all duration-300"
                style={{ width: `${storage.percent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Surveys, images, audio audits, and encrypted payloads are persisted locally in IndexedDB and LocalStorage for 100% offline fieldwork durability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
