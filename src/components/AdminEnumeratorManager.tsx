import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Smartphone,
  MapPin,
  FileText,
  X,
  Check,
} from 'lucide-react';
import { EnumeratorProfile, FormDefinition } from '../types/survey.ts';

interface AdminEnumeratorManagerProps {
  enumerators: EnumeratorProfile[];
  forms: FormDefinition[];
  onToggleStatus: (enumeratorId: string, active: boolean) => void;
  onAddEnumerator: (enumerator: EnumeratorProfile) => void;
  onAssignForms: (enumeratorId: string, formIds: string[]) => void;
}

export const AdminEnumeratorManager: React.FC<AdminEnumeratorManagerProps> = ({
  enumerators,
  forms,
  onToggleStatus,
  onAddEnumerator,
  onAssignForms,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEnumForAssign, setSelectedEnumForAssign] = useState<EnumeratorProfile | null>(null);
  const [assignedFormIds, setAssignedFormIds] = useState<string[]>([]);

  // Add form fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRegion, setNewRegion] = useState('Greater Accra Coastal');
  const [newDeviceId, setNewDeviceId] = useState(`CMRG-TAB-${Math.floor(100 + Math.random() * 900)}`);

  const filtered = enumerators.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.region.toLowerCase().includes(q) ||
      e.deviceId.toLowerCase().includes(q)
    );
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const newProfile: EnumeratorProfile = {
      id: `enum_${Date.now()}`,
      name: newName,
      email: newEmail,
      phone: newPhone || '+233 20 000 0000',
      region: newRegion,
      deviceId: newDeviceId,
      active: true,
      totalSubmissions: 0,
      lastActiveAt: 'Just now',
      batteryLevel: 100,
    };

    onAddEnumerator(newProfile);
    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
  };

  const openAssignModal = (e: EnumeratorProfile) => {
    setSelectedEnumForAssign(e);
    setAssignedFormIds(forms.map((f) => f.formId)); // default assigned
  };

  const handleSaveAssignments = () => {
    if (!selectedEnumForAssign) return;
    onAssignForms(selectedEnumForAssign.id, assignedFormIds);
    setSelectedEnumForAssign(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-red-500 uppercase">
            ADMINISTRATIVE ACCESS CONTROL
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Enumerator & Field Officer Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage field surveyor accounts, assign authorized questionnaires, and instantly deactivate access for suspended devices.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950/60 active:scale-95 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Enumerator</span>
        </button>
      </div>

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, region, device ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div>
            Total Enumerators: <strong className="text-white">{enumerators.length}</strong>
          </div>
          <span>•</span>
          <div>
            Active Access: <strong className="text-emerald-400">{enumerators.filter((e) => e.active).length}</strong>
          </div>
          <span>•</span>
          <div>
            Deactivated: <strong className="text-red-400">{enumerators.filter((e) => !e.active).length}</strong>
          </div>
        </div>
      </div>

      {/* Enumerator Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3 px-4">Officer Name & ID</th>
                <th className="py-3 px-4">Field Sector</th>
                <th className="py-3 px-4">Device ID</th>
                <th className="py-3 px-4">Interviews</th>
                <th className="py-3 px-4">Access Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {filtered.map((e) => {
                return (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{e.name}</span>
                        {!e.active && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            DEACTIVATED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{e.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                        <span>{e.region}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{e.deviceId}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {e.totalSubmissions || 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onToggleStatus(e.id, !e.active)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                          e.active
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                        }`}
                        title="Click to toggle active/deactivated access"
                      >
                        {e.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{e.active ? 'Active' : 'Deactivated'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openAssignModal(e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-red-400" />
                        <span>Assign Questionnaires</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Enumerator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Register New Enumerator</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Samuel K. Osei"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Field Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="s.osei@field.cmrg.org"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+233 24 000 0000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Field Sector</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Device ID / Asset Tag</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs shadow-md shadow-red-950/60"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Questionnaires Modal */}
      {selectedEnumForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Assign Questionnaires</h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Officer: <strong className="text-white">{selectedEnumForAssign.name}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedEnumForAssign(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300">
                Select questionnaires authorized for this enumerator's device:
              </p>

              {forms.map((f) => {
                const isAssigned = assignedFormIds.includes(f.formId);
                const toggle = () => {
                  setAssignedFormIds((prev) =>
                    isAssigned ? prev.filter((id) => id !== f.formId) : [...prev, f.formId]
                  );
                };

                return (
                  <div
                    key={f.id}
                    onClick={toggle}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isAssigned
                        ? 'bg-red-950/30 border-red-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white">{f.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {f.formId}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isAssigned ? 'border-red-500 bg-red-600 text-white' : 'border-slate-600'
                      }`}
                    >
                      {isAssigned && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedEnumForAssign(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignments}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs"
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
