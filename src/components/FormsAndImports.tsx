import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Upload,
  QrCode,
  Lock,
  Download,
  Trash2,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { FormDefinition } from '../types/survey.ts';
import { DEFAULT_CMRG_PUBLIC_KEY } from '../lib/crypto.ts';

interface FormsAndImportsProps {
  forms: FormDefinition[];
  onAddForm: (form: FormDefinition) => void;
  onDeleteForm: (formId: string) => void;
  onSelectFormToCollect: (formId: string) => void;
}

export const FormsAndImports: React.FC<FormsAndImportsProps> = ({
  forms,
  onAddForm,
  onDeleteForm,
  onSelectFormToCollect,
}) => {
  const [activeModal, setActiveModal] = useState<'import' | 'new' | 'qr' | null>(null);
  const [selectedFormForQr, setSelectedFormForQr] = useState<FormDefinition | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Import state
  const [importJson, setImportJson] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  // New form builder state
  const [newTitle, setNewTitle] = useState('');
  const [newFormId, setNewFormId] = useState('');
  const [newCategory, setNewCategory] = useState('Market Research');
  const [newDescription, setNewDescription] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(true);

  const openQrModal = async (form: FormDefinition) => {
    setSelectedFormForQr(form);
    try {
      const payload = JSON.stringify({
        cmrg_action: 'fetch_form',
        form_id: form.formId,
        title: form.title,
        version: form.version,
        endpoint: window.location.origin,
      });
      const url = await QRCode.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
      setActiveModal('qr');
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  const handleImportSubmit = () => {
    try {
      setImportError('');
      const parsed = JSON.parse(importJson);
      if (!parsed.formId || !parsed.title || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid format: Missing formId, title, or questions array.');
      }
      const importedForm: FormDefinition = {
        id: `form_${Date.now()}`,
        formId: parsed.formId,
        title: parsed.title,
        version: parsed.version || '1.0.0',
        description: parsed.description || 'Imported questionnaire definition',
        category: parsed.category || 'Imported Surveys',
        questions: parsed.questions,
        isEncrypted: Boolean(parsed.isEncrypted),
        publicKey: parsed.publicKey || DEFAULT_CMRG_PUBLIC_KEY,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submissionsCount: 0,
      };

      onAddForm(importedForm);
      setActiveModal(null);
      setImportJson('');
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON syntax');
    }
  };

  const handleCreateNewForm = () => {
    if (!newTitle.trim()) return;
    const formIdClean = (newFormId || newTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();

    const created: FormDefinition = {
      id: `form_${Date.now()}`,
      formId: formIdClean,
      title: newTitle,
      version: '1.0.0',
      description: newDescription || 'Standard field research protocol',
      category: newCategory,
      questions: [
        {
          id: 'q1',
          name: 'respondent_name',
          type: 'text',
          label: '1. Respondent Full Name',
          required: true,
        },
        {
          id: 'q2',
          name: 'interview_gps',
          type: 'geopoint',
          label: '2. Interview Geographic GPS Coordinates',
          required: true,
        },
        {
          id: 'q3',
          name: 'verification_signature',
          type: 'signature',
          label: '3. Respondent Signature',
          required: true,
        },
      ],
      isEncrypted,
      publicKey: isEncrypted ? DEFAULT_CMRG_PUBLIC_KEY : undefined,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submissionsCount: 0,
    };

    onAddForm(created);
    setActiveModal(null);
    setNewTitle('');
    setNewFormId('');
    setNewDescription('');
  };

  const exportFormJson = (form: FormDefinition) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(form, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${form.formId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            QUESTIONNAIRES & FORM CATALOG
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Forms & imports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deploy XLSForms, scan configuration barcodes, and distribute encrypted questionnaires to field teams.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveModal('import')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5 text-red-400" />
            <span>Import XLSForm / JSON</span>
          </button>

          <button
            onClick={() => setActiveModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Form</span>
          </button>
        </div>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {forms.map((f) => {
          return (
            <div
              key={f.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg relative group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {f.category}
                  </span>

                  <div className="flex items-center gap-1">
                    {f.isEncrypted && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        <Lock className="w-2.5 h-2.5" />
                        AES-256
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      v{f.version}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-red-400 transition">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {f.description}
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
                  <span>{f.questions.length} questions</span>
                  <span className="text-slate-300 font-semibold">
                    {f.submissionsCount || 0} interviews
                  </span>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectFormToCollect(f.formId)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md transition active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Collect</span>
                </button>

                <button
                  onClick={() => openQrModal(f)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                  title="Generate QR code for field device scanning"
                >
                  <QrCode className="w-4 h-4 text-red-400" />
                </button>

                <button
                  onClick={() => exportFormJson(f)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                  title="Export Form JSON"
                >
                  <Download className="w-4 h-4" />
                </button>

                {forms.length > 1 && (
                  <button
                    onClick={() => onDeleteForm(f.id)}
                    className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 transition"
                    title="Delete Form"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Modal for Field PWA QR Scanning */}
      {activeModal === 'qr' && selectedFormForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-white">Device Quick Setup QR</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Scan this QR code with the <strong>CMRG DataCollect PWA</strong> on any mobile phone to install <strong>{selectedFormForQr.title}</strong> directly without the app store!
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
              <img src={qrDataUrl} alt="Survey QR code" className="w-48 h-48 mx-auto" />
            </div>

            <div className="text-[10px] font-mono text-slate-400">
              Form ID: {selectedFormForQr.formId} | v{selectedFormForQr.version}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Import XLSForm / JSON Modal */}
      {activeModal === 'import' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Import Questionnaire Schema</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Paste your questionnaire JSON schema or form definition below:
            </p>

            <textarea
              rows={8}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={`{\n  "formId": "my_new_survey",\n  "title": "Community Health Survey",\n  "version": "1.0",\n  "questions": [\n    { "id": "q1", "name": "q_name", "type": "text", "label": "Full Name", "required": true }\n  ]\n}`}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-red-500 outline-none"
            />

            {importError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                {importError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950/50"
              >
                Parse & Install Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Form Modal */}
      {activeModal === 'new' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create New Survey Protocol</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Form Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Urban Retail Merchant Tracker"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                >
                  <option value="Market Research">Market Research</option>
                  <option value="Socio-Economic">Socio-Economic</option>
                  <option value="Public Health">Public Health</option>
                  <option value="Agriculture & Supply Chain">Agriculture & Supply Chain</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Objectives, target respondents, and geographic scope"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">End-to-End Encryption</div>
                    <div className="text-[10px] text-slate-400">Encrypt payload with AES-256 + RSA</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={(e) => setIsEncrypted(e.target.checked)}
                  className="w-4 h-4 accent-red-600 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewForm}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950/50"
              >
                Create Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
