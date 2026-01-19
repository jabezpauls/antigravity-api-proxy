/**
 * Database Migrations
 * Schema versioning and migrations for SQLite
 */

import { logger } from '../utils/logger.js';

/**
 * All migrations in order
 * Each migration has a version number and up/down SQL
 */
const migrations = [
    {
        version: 1,
        name: 'initial_schema',
        up: `
            -- API Keys table
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                name TEXT NOT NULL,

                -- Restrictions
                allowed_models TEXT,
                rate_limit_rpm INTEGER,
                rate_limit_rph INTEGER,
                ip_whitelist TEXT,
                expires_at INTEGER,

                -- Status
                enabled INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL,
                last_used_at INTEGER,
                request_count INTEGER DEFAULT 0,

                -- Metadata
                notes TEXT
            );

            -- Request Logs table
            CREATE TABLE IF NOT EXISTS request_logs (
                id TEXT PRIMARY KEY,
                api_key_id TEXT NOT NULL,

                -- Request
                timestamp INTEGER NOT NULL,
                model TEXT NOT NULL,
                actual_model TEXT,
                account_email TEXT,

                -- Content (full prompts & responses)
                request_messages TEXT NOT NULL,
                request_system TEXT,
                response_content TEXT,

                -- Metrics
                input_tokens INTEGER,
                output_tokens INTEGER,
                duration_ms INTEGER,

                -- Status
                status TEXT NOT NULL,
                error_message TEXT,
                http_status INTEGER,

                -- Client info
                client_ip TEXT,
                user_agent TEXT,

                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
            );

            -- Indexes for efficient querying
            CREATE INDEX IF NOT EXISTS idx_logs_api_key ON request_logs(api_key_id);
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON request_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_model ON request_logs(model);
            CREATE INDEX IF NOT EXISTS idx_logs_status ON request_logs(status);

            -- Migrations tracking table
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL
            );
        `
    }
];

/**
 * Get the current schema version
 * @param {Database} db - The database instance
 * @returns {number} The current version (0 if no migrations applied)
 */
function getCurrentVersion(db) {
    try {
        // Check if migrations table exists
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='migrations'
        `).get();

        if (!tableExists) {
            return 0;
        }

        const result = db.prepare('SELECT MAX(version) as version FROM migrations').get();
        return result?.version || 0;
    } catch (error) {
        return 0;
    }
}

/**
 * Run all pending migrations
 * @param {Database} db - The database instance
 */
export function runMigrations(db) {
    const currentVersion = getCurrentVersion(db);
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
        logger.debug('[Database] Schema is up to date (version ' + currentVersion + ')');
        return;
    }

    logger.info(`[Database] Running ${pendingMigrations.length} migration(s)...`);

    for (const migration of pendingMigrations) {
        try {
            db.exec(migration.up);

            // Record the migration
            db.prepare(`
                INSERT INTO migrations (version, name, applied_at)
                VALUES (?, ?, ?)
            `).run(migration.version, migration.name, Date.now());

            logger.info(`[Database] Applied migration ${migration.version}: ${migration.name}`);
        } catch (error) {
            logger.error(`[Database] Migration ${migration.version} failed:`, error);
            throw error;
        }
    }

    logger.success(`[Database] All migrations applied (now at version ${migrations[migrations.length - 1].version})`);
}

/**
 * Prune old request logs (30-day retention)
 * @param {Database} db - The database instance
 * @param {number} retentionDays - Number of days to keep logs (default: 30)
 * @returns {number} Number of deleted records
 */
export function pruneOldLogs(db, retentionDays = 30) {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const result = db.prepare(`
        DELETE FROM request_logs WHERE timestamp < ?
    `).run(cutoffTime);

    if (result.changes > 0) {
        logger.info(`[Database] Pruned ${result.changes} old log entries`);
    }

    return result.changes;
}
