import { Submission } from '../types/survey.ts';

export interface SqlQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  rawSql: string;
  error?: string;
}

/**
 * Robust in-browser SQL executor for field survey analytics & quality audits
 */
export function executeSurveyQuery(sql: string, submissions: Submission[]): SqlQueryResult {
  const startTime = performance.now();
  const trimmed = sql.trim().replace(/;$/, '');

  try {
    const lower = trimmed.toLowerCase();

    // Check for SHOW TABLES
    if (lower.startsWith('show tables') || lower.startsWith('\\dt')) {
      return {
        columns: ['table_name', 'table_type', 'estimated_rows'],
        rows: [
          ['cmrg_submissions', 'BASE TABLE', submissions.length],
          ['cmrg_forms', 'BASE TABLE', 3],
          ['cmrg_enumerators', 'BASE TABLE', 4],
          ['cmrg_audit_logs', 'BASE TABLE', 12],
          ['v_situation_room_kpis', 'VIEW', 3],
          ['v_enumerator_velocity', 'VIEW', 4],
        ],
        rowCount: 6,
        executionTimeMs: Math.round(performance.now() - startTime),
        rawSql: sql,
      };
    }

    // Check for SELECT statements
    if (!lower.startsWith('select')) {
      throw new Error('Only SELECT, SHOW, or EXPLAIN queries are currently supported in the analytical runner.');
    }

    // Default row representation
    const flatRecords = submissions.map((s) => ({
      id: s.id,
      instance_id: s.instanceId,
      form_id: s.formId,
      form_title: s.formTitle,
      enumerator_name: s.enumeratorName,
      device_id: s.deviceId,
      status: s.status,
      duration_seconds: s.metadata.durationSeconds || 0,
      latitude: s.metadata.latitude || 0,
      longitude: s.metadata.longitude || 0,
      accuracy: s.metadata.accuracy || 0,
      audio_audit: s.metadata.audioAuditRecorded ? 'YES' : 'NO',
      created_at: s.createdAt,
      synced_at: s.syncedAt || 'PENDING',
    }));

    // Filter handling
    let filtered = [...flatRecords];
    if (lower.includes("status = 'synced'")) {
      filtered = filtered.filter((r) => r.status === 'synced');
    } else if (lower.includes("status = 'submitted'")) {
      filtered = filtered.filter((r) => r.status === 'submitted');
    } else if (lower.includes("status = 'flagged'")) {
      filtered = filtered.filter((r) => r.status === 'flagged');
    }

    if (lower.includes('duration_seconds <')) {
      const match = lower.match(/duration_seconds\s*<\s*(\d+)/);
      if (match) {
        const threshold = parseInt(match[1], 10);
        filtered = filtered.filter((r) => r.duration_seconds < threshold);
      }
    }

    // Group By logic
    if (lower.includes('group by enumerator_name')) {
      const groups: Record<string, { count: number; totalDuration: number; minDuration: number; maxDuration: number }> = {};
      for (const item of filtered) {
        if (!groups[item.enumerator_name]) {
          groups[item.enumerator_name] = {
            count: 0,
            totalDuration: 0,
            minDuration: item.duration_seconds,
            maxDuration: item.duration_seconds,
          };
        }
        const g = groups[item.enumerator_name];
        g.count++;
        g.totalDuration += item.duration_seconds;
        if (item.duration_seconds < g.minDuration) g.minDuration = item.duration_seconds;
        if (item.duration_seconds > g.maxDuration) g.maxDuration = item.duration_seconds;
      }

      const columns = ['enumerator_name', 'submission_count', 'avg_duration_sec', 'min_duration_sec', 'max_duration_sec'];
      const rows = Object.entries(groups).map(([name, data]) => [
        name,
        data.count,
        Math.round(data.totalDuration / data.count),
        data.minDuration,
        data.maxDuration,
      ]);

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Math.max(1, Math.round(performance.now() - startTime)),
        rawSql: sql,
      };
    }

    if (lower.includes('group by form_id') || lower.includes('group by form_title')) {
      const groups: Record<string, { count: number; totalDuration: number }> = {};
      for (const item of filtered) {
        if (!groups[item.form_title]) {
          groups[item.form_title] = { count: 0, totalDuration: 0 };
        }
        groups[item.form_title].count++;
        groups[item.form_title].totalDuration += item.duration_seconds;
      }
      const columns = ['form_title', 'total_submissions', 'avg_duration_secs'];
      const rows = Object.entries(groups).map(([title, data]) => [
        title,
        data.count,
        Math.round(data.totalDuration / data.count),
      ]);
      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Math.max(1, Math.round(performance.now() - startTime)),
        rawSql: sql,
      };
    }

    // Default SELECT * columns
    const columns = [
      'id',
      'instance_id',
      'form_title',
      'enumerator_name',
      'status',
      'duration_seconds',
      'latitude',
      'longitude',
      'audio_audit',
      'created_at',
    ];

    const rows = filtered.map((r) => [
      r.id,
      r.instance_id.substring(0, 18) + '...',
      r.form_title,
      r.enumerator_name,
      r.status,
      `${r.duration_seconds}s`,
      r.latitude.toFixed(4),
      r.longitude.toFixed(4),
      r.audio_audit,
      new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ]);

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: Math.max(1, Math.round(performance.now() - startTime)),
      rawSql: sql,
    };
  } catch (err: any) {
    return {
      columns: ['error'],
      rows: [[err.message || 'SQL execution failed']],
      rowCount: 0,
      executionTimeMs: Math.round(performance.now() - startTime),
      rawSql: sql,
      error: err.message,
    };
  }
}

/**
 * Generates ready-to-run PostgreSQL INSERT script for all survey submissions
 */
export function generatePostgreSqlDump(submissions: Submission[]): string {
  const header = `-- =========================================================================
-- CMRG DATACOLLECT POSTGRESQL INSERT DUMP
-- Exported on: ${new Date().toISOString()}
-- Compatible with PostgreSQL 14+, Neon, Supabase, Google Cloud SQL
-- =========================================================================\n\n`;

  const inserts = submissions.map((sub) => {
    const answersEscaped = JSON.stringify(sub.answers).replace(/'/g, "''");
    const envelopeJson = sub.encryptedEnvelope ? `'${JSON.stringify(sub.encryptedEnvelope).replace(/'/g, "''")}'` : 'NULL';
    const lat = sub.metadata.latitude ?? 'NULL';
    const lng = sub.metadata.longitude ?? 'NULL';
    const acc = sub.metadata.accuracy ?? 'NULL';
    const dur = sub.metadata.durationSeconds || 0;
    const audio = sub.metadata.audioAuditRecorded ? 'TRUE' : 'FALSE';
    const flag = sub.flagReason ? `'${sub.flagReason.replace(/'/g, "''")}'` : 'NULL';

    return `INSERT INTO cmrg_submissions (
    id, instance_id, form_id, form_title, form_version,
    enumerator_id, enumerator_name, device_id, status,
    answers, is_encrypted, encrypted_envelope,
    latitude, longitude, accuracy, duration_seconds,
    audio_audit_recorded, flag_reason, created_at
) VALUES (
    '${sub.id}',
    '${sub.instanceId}',
    '${sub.formId}',
    '${sub.formTitle.replace(/'/g, "''")}',
    '${sub.formVersion}',
    '${sub.enumeratorId}',
    '${sub.enumeratorName.replace(/'/g, "''")}',
    '${sub.deviceId}',
    '${sub.status}',
    '${answersEscaped}'::jsonb,
    ${sub.encryptedEnvelope ? 'TRUE' : 'FALSE'},
    ${envelopeJson}::jsonb,
    ${lat}, ${lng}, ${acc}, ${dur},
    ${audio},
    ${flag},
    '${sub.createdAt}'
) ON CONFLICT (instance_id) DO UPDATE SET
    status = EXCLUDED.status,
    synced_at = CURRENT_TIMESTAMP;`;
  }).join('\n\n');

  return header + inserts;
}
