/**
 * API Key Validator
 * Validates API keys and checks restrictions (model, IP, expiration)
 */

import { hashApiKey, findApiKeyByHash } from '../database/models/api-keys.js';
import { checkRateLimit } from './rate-limiter.js';

/**
 * Match a model name against a pattern (supports glob-like wildcards)
 * Examples:
 *   - "claude-*" matches "claude-opus-4-5", "claude-sonnet-4-5"
 *   - "gemini-3-*" matches "gemini-3-flash", "gemini-3-pro"
 *   - "gpt-4" matches only "gpt-4" exactly
 *
 * @param {string} model - The model name to check
 * @param {string} pattern - The pattern to match against
 * @returns {boolean} True if model matches pattern
 */
export function matchModelPattern(model, pattern) {
    if (!pattern || !model) return false;

    // Escape special regex chars except *
    const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(model);
}

/**
 * Check if a model is allowed by the key's model restrictions
 * @param {string} model - The requested model
 * @param {string[]|null} allowedModels - Array of allowed model patterns (null = all)
 * @returns {boolean} True if model is allowed
 */
export function isModelAllowed(model, allowedModels) {
    // null = all models allowed
    if (!allowedModels || allowedModels.length === 0) {
        return true;
    }

    return allowedModels.some(pattern => matchModelPattern(model, pattern));
}

/**
 * Match an IP address against a pattern (supports wildcards)
 * Examples:
 *   - "192.168.1.*" matches "192.168.1.100", "192.168.1.1"
 *   - "10.0.0.1" matches only "10.0.0.1" exactly
 *   - "::1" matches localhost IPv6
 *
 * @param {string} ip - The client IP to check
 * @param {string} pattern - The pattern to match against
 * @returns {boolean} True if IP matches pattern
 */
export function matchIpPattern(ip, pattern) {
    if (!pattern || !ip) return false;

    // Normalize IPv6 localhost
    const normalizedIp = ip === '::1' ? '127.0.0.1' : ip;
    const normalizedPattern = pattern === '::1' ? '127.0.0.1' : pattern;

    // Remove IPv6 prefix if present (e.g., "::ffff:192.168.1.1")
    const cleanIp = normalizedIp.replace(/^::ffff:/, '');

    // Escape special regex chars except *
    const regexPattern = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(cleanIp);
}

/**
 * Check if an IP is allowed by the key's IP whitelist
 * @param {string} ip - The client IP
 * @param {string[]|null} ipWhitelist - Array of allowed IP patterns (null = all)
 * @returns {boolean} True if IP is allowed
 */
export function isIpAllowed(ip, ipWhitelist) {
    // null = all IPs allowed
    if (!ipWhitelist || ipWhitelist.length === 0) {
        return true;
    }

    return ipWhitelist.some(pattern => matchIpPattern(ip, pattern));
}

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the key is valid
 * @property {Object|null} key - The key entry if valid
 * @property {string|null} error - Error message if invalid
 * @property {number} [status] - HTTP status code for error
 * @property {number} [retryAfter] - Seconds until rate limit resets
 */

/**
 * Validate an API key and check all restrictions
 * @param {string} providedKey - The API key from the request
 * @param {Object} context - Request context
 * @param {string} context.model - The requested model
 * @param {string} context.ip - The client IP
 * @returns {ValidationResult} Validation result
 */
export function validateApiKey(providedKey, context = {}) {
    const { model, ip } = context;

    // Check if key is provided
    if (!providedKey) {
        return {
            valid: false,
            key: null,
            error: 'API key is required',
            status: 401
        };
    }

    // Look up key by hash
    const keyHash = hashApiKey(providedKey);
    const keyEntry = findApiKeyByHash(keyHash);

    if (!keyEntry) {
        return {
            valid: false,
            key: null,
            error: 'Invalid API key',
            status: 401
        };
    }

    // Check if key is enabled
    if (!keyEntry.enabled) {
        return {
            valid: false,
            key: keyEntry,
            error: 'API key is disabled',
            status: 403
        };
    }

    // Check expiration
    if (keyEntry.expires_at && Date.now() > keyEntry.expires_at) {
        return {
            valid: false,
            key: keyEntry,
            error: 'API key has expired',
            status: 403
        };
    }

    // Check IP whitelist
    if (ip && !isIpAllowed(ip, keyEntry.ip_whitelist)) {
        return {
            valid: false,
            key: keyEntry,
            error: `IP address ${ip} is not allowed for this API key`,
            status: 403
        };
    }

    // Check model restrictions (only if model is provided)
    if (model && !isModelAllowed(model, keyEntry.allowed_models)) {
        return {
            valid: false,
            key: keyEntry,
            error: `Model ${model} is not allowed for this API key`,
            status: 403
        };
    }

    // Check rate limits
    const rateLimitResult = checkRateLimit(keyEntry);
    if (!rateLimitResult.allowed) {
        return {
            valid: false,
            key: keyEntry,
            error: rateLimitResult.error,
            status: 429,
            retryAfter: rateLimitResult.retryAfter
        };
    }

    // All checks passed
    return {
        valid: true,
        key: keyEntry,
        error: null
    };
}

/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer <key> and X-API-Key: <key>
 * @param {Object} headers - Request headers
 * @returns {string|null} The API key or null
 */
export function extractApiKey(headers) {
    // Check Authorization header (Bearer token)
    const authHeader = headers.authorization || headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check X-API-Key header
    const xApiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (xApiKey) {
        return xApiKey;
    }

    return null;
}
