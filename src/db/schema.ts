import { pgTable, text, varchar, integer, doublePrecision, boolean, timestamp, jsonb, bigserial } from 'drizzle-orm/pg-core';

export const cmrgProjects = pgTable('cmrg_projects', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  organization: varchar('organization', { length: 255 }).default('Communication and Marketing Research Group'),
  status: varchar('status', { length: 32 }).default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cmrgEnumerators = pgTable('cmrg_enumerators', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 64 }),
  region: varchar('region', { length: 128 }).notNull(),
  deviceId: varchar('device_id', { length: 128 }).notNull(),
  active: boolean('active').default(true),
  totalSubmissions: integer('total_submissions').default(0),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  batteryLevel: integer('battery_level'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const cmrgForms = pgTable('cmrg_forms', {
  id: varchar('id', { length: 64 }).primaryKey(),
  formId: varchar('form_id', { length: 128 }).unique().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  version: varchar('version', { length: 32 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 64 }).default('General Fieldwork'),
  schemaJson: jsonb('schema_json').notNull(),
  isEncrypted: boolean('is_encrypted').default(false),
  publicKey: text('public_key'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cmrgSubmissions = pgTable('cmrg_submissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  instanceId: varchar('instance_id', { length: 128 }).unique().notNull(),
  formId: varchar('form_id', { length: 128 }).notNull(),
  formTitle: varchar('form_title', { length: 255 }).notNull(),
  formVersion: varchar('form_version', { length: 32 }).notNull(),
  enumeratorId: varchar('enumerator_id', { length: 64 }),
  enumeratorName: varchar('enumerator_name', { length: 255 }).notNull(),
  deviceId: varchar('device_id', { length: 128 }).notNull(),
  status: varchar('status', { length: 32 }).default('submitted').notNull(),
  answers: jsonb('answers').default({}).notNull(),
  isEncrypted: boolean('is_encrypted').default(false),
  encryptedEnvelope: jsonb('encrypted_envelope'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  altitude: doublePrecision('altitude'),
  accuracy: doublePrecision('accuracy'),
  durationSeconds: integer('duration_seconds').default(0).notNull(),
  audioAuditRecorded: boolean('audio_audit_recorded').default(false),
  flagReason: text('flag_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

export const cmrgResponses = pgTable('cmrg_responses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  submissionId: varchar('submission_id', { length: 64 }).notNull(),
  formId: varchar('form_id', { length: 128 }).notNull(),
  questionName: varchar('question_name', { length: 128 }).notNull(),
  questionType: varchar('question_type', { length: 32 }).notNull(),
  responseText: text('response_text'),
  responseNumeric: doublePrecision('response_numeric'),
  responseJson: jsonb('response_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const cmrgAuditLogs = pgTable('cmrg_audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  submissionId: varchar('submission_id', { length: 64 }),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  enumeratorId: varchar('enumerator_id', { length: 64 }),
  severity: varchar('severity', { length: 32 }).default('low'),
  message: text('message').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
