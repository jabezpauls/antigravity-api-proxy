import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from './utils/logger.js';

// Default config
const DEFAULT_CONFIG = {
    apiKey: '',           // Legacy single API key (backward compatible)
    apiKeys: [],          // Array of API key objects: [{ id, key, name, enabled, createdAt, lastUsed, requestCount }]
    webuiPassword: '',
    debug: false,
    logLevel: 'info',
    maxRetries: 5,
    retryBaseMs: 1000,
    retryMaxMs: 30000,
    persistTokenCache: false,
    defaultCooldownMs: 10000,  // 10 seconds
    maxWaitBeforeErrorMs: 120000, // 2 minutes
    modelMapping: {},
    // Account selection strategy configuration
    accountSelection: {
        strategy: 'hybrid',           // 'sticky' | 'round-robin' | 'hybrid'
        // Hybrid strategy tuning (optional - sensible defaults)
        healthScore: {
            initial: 70,              // Starting score for new accounts
            successReward: 1,         // Points on successful request
            rateLimitPenalty: -10,    // Points on rate limit
            failurePenalty: -20,      // Points on other failures
            recoveryPerHour: 2,       // Passive recovery rate
            minUsable: 50,            // Minimum score to be selected
            maxScore: 100             // Maximum score cap
        },
        tokenBucket: {
            maxTokens: 50,            // Maximum token capacity
            tokensPerMinute: 6,       // Regeneration rate
            initialTokens: 50         // Starting tokens
        }
    }
};

// Config locations
const HOME_DIR = os.homedir();
const CONFIG_DIR = path.join(HOME_DIR, '.config', 'antigravity-proxy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config dir exists
if (!fs.existsSync(CONFIG_DIR)) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    } catch (err) {
        // Ignore
    }
}

// Load config
let config = { ...DEFAULT_CONFIG };

function loadConfig() {
    try {
        // Env vars take precedence for initial defaults, but file overrides them if present?
        // Usually Env > File > Default.

        if (fs.existsSync(CONFIG_FILE)) {
            const fileContent = fs.readFileSync(CONFIG_FILE, 'utf8');
            const userConfig = JSON.parse(fileContent);
            config = { ...DEFAULT_CONFIG, ...userConfig };
        } else {
             // Try looking in current dir for config.json as fallback
             const localConfigPath = path.resolve('config.json');
             if (fs.existsSync(localConfigPath)) {
                 const fileContent = fs.readFileSync(localConfigPath, 'utf8');
                 const userConfig = JSON.parse(fileContent);
                 config = { ...DEFAULT_CONFIG, ...userConfig };
             }
        }

        // Environment overrides
        if (process.env.API_KEY) config.apiKey = process.env.API_KEY;
        if (process.env.WEBUI_PASSWORD) config.webuiPassword = process.env.WEBUI_PASSWORD;
        if (process.env.DEBUG === 'true') config.debug = true;

    } catch (error) {
        logger.error('[Config] Error loading config:', error);
    }
}

// Initial load
loadConfig();

export function getPublicConfig() {
    return { ...config };
}

export function saveConfig(updates) {
    try {
        // Apply updates
        config = { ...config, ...updates };

        // Save to disk
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error('[Config] Failed to save config:', error);
        return false;
    }
}

/**
 * Generate a new API key
 * Format: sk-ag-<32 random hex chars>
 * @returns {string} The generated API key
 */
export function generateApiKey() {
    return `sk-ag-${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Create a new API key entry
 * @param {string} name - Display name for the key
 * @returns {Object} The new key entry (with full key visible)
 */
export function createApiKey(name = 'Unnamed Key') {
    const key = generateApiKey();
    const entry = {
        id: crypto.randomUUID(),
        key: key,
        name: name,
        enabled: true,
        createdAt: Date.now(),
        lastUsed: null,
        requestCount: 0
    };

    // Add to config
    if (!config.apiKeys) {
        config.apiKeys = [];
    }
    config.apiKeys.push(entry);

    // Save config
    saveConfig({ apiKeys: config.apiKeys });

    return entry;
}

/**
 * Get all API keys (with keys masked for display)
 * @returns {Array} Array of key entries with masked keys
 */
export function listApiKeys() {
    const keys = config.apiKeys || [];
    return keys.map(entry => ({
        id: entry.id,
        name: entry.name,
        keyMasked: entry.key ? `sk-ag-****${entry.key.slice(-4)}` : 'invalid',
        enabled: entry.enabled,
        createdAt: entry.createdAt,
        lastUsed: entry.lastUsed,
        requestCount: entry.requestCount || 0
    }));
}

/**
 * Validate an API key
 * Checks both legacy single key and multi-key array
 * @param {string} providedKey - The key to validate
 * @returns {{ valid: boolean, keyEntry?: Object }} Validation result
 */
export function validateApiKey(providedKey) {
    if (!providedKey) {
        return { valid: false };
    }

    // Check legacy single key first
    if (config.apiKey && providedKey === config.apiKey) {
        return { valid: true, keyEntry: null }; // null indicates legacy key
    }

    // Check multi-key array
    const keys = config.apiKeys || [];
    const keyEntry = keys.find(entry => entry.key === providedKey && entry.enabled);

    if (keyEntry) {
        return { valid: true, keyEntry };
    }

    return { valid: false };
}

/**
 * Record API key usage
 * @param {string} keyId - The key ID that was used
 */
export function recordApiKeyUsage(keyId) {
    if (!keyId) return;

    const keys = config.apiKeys || [];
    const entry = keys.find(k => k.id === keyId);
    if (entry) {
        entry.lastUsed = Date.now();
        entry.requestCount = (entry.requestCount || 0) + 1;
        // Save async (don't block request)
        saveConfig({ apiKeys: config.apiKeys });
    }
}

/**
 * Update an API key entry
 * @param {string} keyId - The key ID to update
 * @param {Object} updates - Fields to update (name, enabled)
 * @returns {boolean} Success
 */
export function updateApiKey(keyId, updates) {
    const keys = config.apiKeys || [];
    const entry = keys.find(k => k.id === keyId);
    if (!entry) return false;

    if (updates.name !== undefined) entry.name = updates.name;
    if (updates.enabled !== undefined) entry.enabled = updates.enabled;

    saveConfig({ apiKeys: config.apiKeys });
    return true;
}

/**
 * Delete an API key
 * @param {string} keyId - The key ID to delete
 * @returns {boolean} Success
 */
export function deleteApiKey(keyId) {
    const keys = config.apiKeys || [];
    const index = keys.findIndex(k => k.id === keyId);
    if (index === -1) return false;

    keys.splice(index, 1);
    config.apiKeys = keys;
    saveConfig({ apiKeys: config.apiKeys });
    return true;
}

/**
 * Check if API key authentication is required
 * Returns true if either legacy apiKey or apiKeys array is configured
 * @returns {boolean}
 */
export function isApiKeyRequired() {
    return !!(config.apiKey || (config.apiKeys && config.apiKeys.length > 0));
}

export { config };