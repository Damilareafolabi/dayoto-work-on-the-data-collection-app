import React, { useState } from 'react';
import {
  Database,
  Play,
  Copy,
  Download,
  Check,
  Table,
  Layers,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Submission } from '../types/survey.ts';
import { executeSurveyQuery, SqlQueryResult } from '../lib/sqlEngine.ts';

interface SQLStudioProps {
  submissions: Submission[];
}

const PRESET_QUERIES = [
  {
    name: 'Enumerator Velocity & Audit Outliers',
    sql: `SELECT enumerator_name, COUNT(*) AS submission_count, AVG(duration_seconds) AS avg_duration_sec\nFROM cmrg_submissions\nGROUP BY enumerator_name;`,
  },
  {
    name: 'Form Breakdown & Performance',
    sql: `SELECT form_title, COUNT(*) AS total_submissions, AVG(duration_seconds) AS avg_duration_secs\nFROM cmrg_submissions\nGROUP BY form_title;`,
  },
  {
    name: 'Recent Survey Submissions Raw View',
    sql: `SELECT id, instance_id, form_title, enumerator_name, status, duration_seconds\nFROM cmrg_submissions\nLIMIT 20;`,
  },
  {
    name: 'Show Database Tables & Views',
    sql: `SHOW TABLES;`,
  },
];

export const SQLStudio: React.FC<SQLStudioProps> = ({ submissions }) => {
  const [activeTab, setActiveTab] = useState<'runner' | 'schema' | 'connection'>('runner');
  const [sqlInput, setSqlInput] = useState<string>(PRESET_QUERIES[0].sql);
  const [queryResult, setQueryResult] = useState<SqlQueryResult>(() =>
    executeSurveyQuery(PRESET_QUERIES[0].sql, submissions)
  );
  const [copied, setCopied] = useState(false);

  const handleRunQuery = () => {
    const res = executeSurveyQuery(sqlInput, submissions);
    setQueryResult(res);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-950">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-400 uppercase">
            POSTGRESQL & RELATIONAL QUERY STUDIO
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            SQL Engine & Database Architecture
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Execute SQL analytical queries, inspect DDL schema, and integrate with PostgreSQL, Neon, and Cloud SQL.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('runner')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'runner'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SQL Query Runner
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'schema'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            PostgreSQL DDL Schema
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'connection'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Drizzle & Connectors
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: INTERACTIVE SQL QUERY RUNNER
          ========================================================================= */}
      {activeTab === 'runner' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Presets:</span>
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setSqlInput(preset.sql);
                  setQueryResult(executeSurveyQuery(preset.sql, submissions));
                }}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-slate-300 text-xs font-medium transition"
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* SQL Editor Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-mono">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>cmrg_data_analytics=#</span>
              </div>
              <button
                onClick={handleRunQuery}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute SQL</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              className="w-full p-4 bg-slate-950/80 text-emerald-400 font-mono text-xs outline-none resize-none leading-relaxed"
              placeholder="SELECT * FROM cmrg_submissions WHERE status = 'synced';"
            />
          </div>

          {/* Query Execution Status */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Execution Result:</span>
              <span>{queryResult.rowCount} rows returned</span>
            </div>
            <div className="font-mono text-emerald-400">
              Query completed in {queryResult.executionTimeMs} ms
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0 text-[10px]">
                  <tr>
                    {queryResult.columns.map((col) => (
                      <th key={col} className="py-3 px-4">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {queryResult.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      {row.map((val, cellIdx) => (
                        <td key={cellIdx} className="py-2.5 px-4 truncate max-w-xs">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {queryResult.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={queryResult.columns.length}
                        className="py-8 text-center text-slate-500 font-sans"
                      >
                        No matching records returned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: POSTGRESQL DDL SCHEMA
          ========================================================================= */}
      {activeTab === 'schema' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Production DDL Schema located at <code>src/db/schema.sql</code>. Includes PostGIS spatial indexes and analytical views.
            </div>
            <button
              onClick={() => {
                copyToClipboard(`-- CMRG DATACOLLECT POSTGRESQL SCHEMA\n-- Run in psql or Neon Console`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy DDL'}</span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 font-mono text-xs text-slate-300 max-h-[600px] overflow-y-auto space-y-4 leading-relaxed">
            <div className="text-slate-500">
              -- 1. Central Submissions Table with JSONB & Spatial Coordinates
            </div>
            <pre className="text-emerald-400">
{`CREATE TABLE cmrg_submissions (
    id VARCHAR(64) PRIMARY KEY,
    instance_id VARCHAR(128) UNIQUE NOT NULL,
    form_id VARCHAR(128) NOT NULL REFERENCES cmrg_forms(form_id),
    form_title VARCHAR(255) NOT NULL,
    form_version VARCHAR(32) NOT NULL,
    enumerator_id VARCHAR(64) REFERENCES cmrg_enumerators(id),
    enumerator_name VARCHAR(255) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'submitted',
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encrypted_envelope JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_answers_gin ON cmrg_submissions USING GIN (answers);
CREATE INDEX idx_submissions_coords ON cmrg_submissions (latitude, longitude);`}
            </pre>

            <div className="text-slate-500">
              -- 2. Situation Room Analytical View
            </div>
            <pre className="text-blue-300">
{`CREATE OR REPLACE VIEW v_situation_room_kpis AS
SELECT
    f.form_id,
    f.title AS form_title,
    COUNT(s.id) AS total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'synced') AS synced_count,
    ROUND(AVG(s.duration_seconds)::numeric, 1) AS avg_duration_seconds
FROM cmrg_forms f
LEFT JOIN cmrg_submissions s ON f.form_id = s.form_id
GROUP BY f.form_id, f.title;`}
            </pre>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DRIZZLE ORM & CONNECTORS
          ========================================================================= */}
      {activeTab === 'connection' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm">PostgreSQL / Neon / Cloud SQL Connection Options</h3>
            <p className="text-slate-400">
              This applet is fully prepared for server-side PostgreSQL integration with Drizzle ORM.
              The Drizzle definitions are configured in <code>src/db/schema.ts</code>.
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div># PostgreSQL Server Environment Variables (.env)</div>
              <div className="text-emerald-400">SQL_HOST="ep-neon-survey-pooler.us-east-2.aws.neon.tech"</div>
              <div className="text-emerald-400">SQL_DB_NAME="cmrg_production_surveys"</div>
              <div className="text-emerald-400">SQL_USER="cmrg_field_agent"</div>
              <div className="text-emerald-400">SQL_PASSWORD="******************"</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
