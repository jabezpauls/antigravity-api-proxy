/**
 * API Keys Data Model
 * CRUD operations for API keys stored in SQLite
 */

import crypto from 'crypto';
import { getDatabase } from '../index.js';

/**
 * Generate a new API key
 * Format: sk-ag-<32 random hex chars>
 * @returns {string} The generated API key
 */
export function generateApiKey() {
    return `sk-ag-${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Hash an API key using SHA-256
 * @param {string} key - The API key to hash
 * @returns {string} The hashed key
 */
export function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get the key prefix for display (sk-ag-xxxx****)
 * @param {string} key - The full API key
 * @returns {string} The masked key prefix
 */
export function getKeyPrefix(key) {
    if (!key || key.length < 12) return 'sk-ag-****';
    return key.substring(0, 10) + '****' + key.slice(-4);
}

/**
 * Create a new API key
 * @param {Object} options - Key options
 * @param {string} options.name - Display name for the key
 * @param {string[]|null} options.allowed_models - Allowed model patterns (null = all)
 * @param {number|null} options.rate_limit_rpm - Requests per minute (null = unlimited)
 * @param {number|null} options.rate_limit_rph - Requests per hour (null = unlimited)
 * @param {string[]|null} options.ip_whitelist - Allowed IPs (null = all)
 * @param {number|null} options.expires_at - Unix timestamp for expiration (null = never)
 * @param {string|null} options.notes - Optional notes
 * @returns {Object} The created key entry with full key (shown only once)
 */
export function createApiKey(options = {}) {
    const db = getDatabase();
    const key = generateApiKey();
    const id = crypto.randomUUID();

    const entry = {
        id,
        key_hash: hashApiKey(key),
        key_prefix: getKeyPrefix(key),
        name: options.name || 'Unnamed Key',
        allowed_models: options.allowed_models ? JSON.stringify(options.allowed_models) : null,
        rate_limit_rpm: options.rate_limit_rpm || null,
        rate_limit_rph: options.rate_limit_rph || null,
        ip_whitelist: options.ip_whitelist ? JSON.stringify(options.ip_whitelist) : null,
        expires_at: options.expires_at || null,
        enabled: 1,
        created_at: Date.now(),
        last_used_at: null,
        request_count: 0,
        notes: options.notes || null
    };

    db.prepare(`
        INSERT INTO api_keys (
            id, key_hash, key_prefix, name,
            allowed_models, rate_limit_rpm, rate_limit_rph, ip_whitelist, expires_at,
            enabled, created_at, last_used_at, request_count, notes
        ) VALUES (
            @id, @key_hash, @key_prefix, @name,
            @allowed_models, @rate_limit_rpm, @rate_limit_rph, @ip_whitelist, @expires_at,
            @enabled, @created_at, @last_used_at, @request_count, @notes
        )
    `).run(entry);

    // Return full key only on creation
    return {
        id,
        key, // Full key - shown only once!
        key_prefix: entry.key_prefix,
        name: entry.name,
        allowed_models: options.allowed_models || null,
        rate_limit_rpm: entry.rate_limit_rpm,
        rate_limit_rph: entry.rate_limit_rph,
        ip_whitelist: options.ip_whitelist || null,
        expires_at: entry.expires_at,
        enabled: true,
        created_at: entry.created_at,
        last_used_at: entry.last_used_at,
        request_count: entry.request_count,
        notes: entry.notes
    };
}

/**
 * Get all API keys (without hashes, with parsed JSON fields)
 * @returns {Array} Array of key entries
 */
export function listApiKeys() {
    const db = getDatabase();
    const rows = db.prepare(`
        SELECT
            id, key_prefix, name,
            allowed_models, rate_limit_rpm, rate_limit_rph, ip_whitelist, expires_at,
            enabled, created_at, last_used_at, request_count, notes
        FROM api_keys
        ORDER BY created_at DESC
    `).all();

    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        allowed_models: row.allowed_models ? JSON.parse(row.allowed_models) : null,
        ip_whitelist: row.ip_whitelist ? JSON.parse(row.ip_whitelist) : null
    }));
}

/**
 * Get a single API key by ID
 * @param {string} id - The key ID
 * @returns {Object|null} The key entry or null if not found
 */
export function getApiKeyById(id) {
    const db = getDatabase();
    const row = db.prepare(`
        SELECT
            id, key_prefix, name,
            allowed_models, rate_limit_rpm, rate_limit_rph, ip_whitelist, expires_at,
            enabled, created_at, last_used_at, request_count, notes
        FROM api_keys
        WHERE id = ?
    `).get(id);

    if (!row) return null;

    return {
        ...row,
        enabled: Boolean(row.enabled),
        allowed_models: row.allowed_models ? JSON.parse(row.allowed_models) : null,
        ip_whitelist: row.ip_whitelist ? JSON.parse(row.ip_whitelist) : null
    };
}

/**
 * Find an API key by its hash
 * @param {string} keyHash - The SHA-256 hash of the key
 * @returns {Object|null} The key entry or null if not found
 */
export function findApiKeyByHash(keyHash) {
    const db = getDatabase();
    const row = db.prepare(`
        SELECT
            id, key_hash, key_prefix, name,
            allowed_models, rate_limit_rpm, rate_limit_rph, ip_whitelist, expires_at,
            enabled, created_at, last_used_at, request_count, notes
        FROM api_keys
        WHERE key_hash = ?
    `).get(keyHash);

    if (!row) return null;

    return {
        ...row,
        enabled: Boolean(row.enabled),
        allowed_models: row.allowed_models ? JSON.parse(row.allowed_models) : null,
        ip_whitelist: row.ip_whitelist ? JSON.parse(row.ip_whitelist) : null
    };
}

/**
 * Update an API key
 * @param {string} id - The key ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} True if updated, false if not found
 */
export function updateApiKey(id, updates) {
    const db = getDatabase();

    const allowedFields = [
        'name', 'allowed_models', 'rate_limit_rpm', 'rate_limit_rph',
        'ip_whitelist', 'expires_at', 'enabled', 'notes'
    ];

    const setClauses = [];
    const params = { id };

    for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.includes(key)) continue;

        let dbValue = value;
        if (key === 'allowed_models' || key === 'ip_whitelist') {
            dbValue = value ? JSON.stringify(value) : null;
        } else if (key === 'enabled') {
            dbValue = value ? 1 : 0;
        }

        setClauses.push(`${key} = @${key}`);
        params[key] = dbValue;
    }

    if (setClauses.length === 0) return false;

    const result = db.prepare(`
        UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = @id
    `).run(params);

    return result.changes > 0;
}

/**
 * Delete an API key
 * @param {string} id - The key ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteApiKey(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
}

/**
 * Regenerate an API key (new key with same settings)
 * @param {string} id - The key ID to regenerate
 * @returns {Object|null} The new key entry with full key, or null if not found
 */
export function regenerateApiKey(id) {
    const db = getDatabase();

    // Get current key settings
    const existing = getApiKeyById(id);
    if (!existing) return null;

    // Generate new key
    const newKey = generateApiKey();
    const newKeyHash = hashApiKey(newKey);
    const newKeyPrefix = getKeyPrefix(newKey);

    // Update the key
    db.prepare(`
        UPDATE api_keys
        SET key_hash = ?, key_prefix = ?, last_used_at = NULL, request_count = 0
        WHERE id = ?
    `).run(newKeyHash, newKeyPrefix, id);

    return {
        ...existing,
        key: newKey, // Full key - shown only once!
        key_prefix: newKeyPrefix,
        last_used_at: null,
        request_count: 0
    };
}

/**
 * Record API key usage (increment count and update last used)
 * @param {string} id - The key ID
 */
export function recordApiKeyUsage(id) {
    const db = getDatabase();
    db.prepare(`
        UPDATE api_keys
        SET request_count = request_count + 1, last_used_at = ?
        WHERE id = ?
    `).run(Date.now(), id);
}

/**
 * Check if any API keys exist
 * @returns {boolean} True if at least one key exists
 */
export function hasApiKeys() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM api_keys').get();
    return result.count > 0;
}
