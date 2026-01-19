/**
 * Rate Limiter
 * Sliding window rate limiting for API keys
 */

/**
 * In-memory store for rate limit tracking
 * Structure: Map<keyId, { rpm: number[], rph: number[] }>
 * - rpm: Array of timestamps for requests in the current minute
 * - rph: Array of timestamps for requests in the current hour
 */
const rateLimitStore = new Map();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [keyId, data] of rateLimitStore.entries()) {
        // Remove timestamps older than 1 hour
        data.rph = data.rph.filter(ts => ts > oneHourAgo);
        data.rpm = data.rpm.filter(ts => ts > now - 60 * 1000);

        // Remove entry if no recent requests
        if (data.rpm.length === 0 && data.rph.length === 0) {
            rateLimitStore.delete(keyId);
        }
    }
}

// Start cleanup interval
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

/**
 * Get or create rate limit data for a key
 * @param {string} keyId - The API key ID
 * @returns {Object} Rate limit data object
 */
function getRateLimitData(keyId) {
    if (!rateLimitStore.has(keyId)) {
        rateLimitStore.set(keyId, { rpm: [], rph: [] });
    }
    return rateLimitStore.get(keyId);
}

/**
 * Rate limit check result
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - Whether the request is allowed
 * @property {string|null} error - Error message if rate limited
 * @property {number|null} retryAfter - Seconds until rate limit resets
 * @property {Object} current - Current usage counts
 */

/**
 * Check if a request is allowed under rate limits
 * Does NOT consume a slot - call recordRequest() after successful request
 *
 * @param {Object} keyEntry - The API key entry
 * @returns {RateLimitResult} Rate limit check result
 */
export function checkRateLimit(keyEntry) {
    const { id, rate_limit_rpm, rate_limit_rph } = keyEntry;

    // No rate limits configured
    if (!rate_limit_rpm && !rate_limit_rph) {
        return {
            allowed: true,
            error: null,
            retryAfter: null,
            current: { rpm: 0, rph: 0 }
        };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const data = getRateLimitData(id);

    // Clean up old timestamps
    data.rpm = data.rpm.filter(ts => ts > oneMinuteAgo);
    data.rph = data.rph.filter(ts => ts > oneHourAgo);

    const currentRpm = data.rpm.length;
    const currentRph = data.rph.length;

    // Check RPM limit
    if (rate_limit_rpm && currentRpm >= rate_limit_rpm) {
        // Calculate when the oldest request in the window expires
        const oldestRpm = Math.min(...data.rpm);
        const retryAfterMs = (oldestRpm + 60 * 1000) - now;
        const retryAfter = Math.ceil(retryAfterMs / 1000);

        return {
            allowed: false,
            error: `Rate limit exceeded: ${currentRpm}/${rate_limit_rpm} requests per minute`,
            retryAfter: Math.max(1, retryAfter),
            current: { rpm: currentRpm, rph: currentRph }
        };
    }

    // Check RPH limit
    if (rate_limit_rph && currentRph >= rate_limit_rph) {
        // Calculate when the oldest request in the window expires
        const oldestRph = Math.min(...data.rph);
        const retryAfterMs = (oldestRph + 60 * 60 * 1000) - now;
        const retryAfter = Math.ceil(retryAfterMs / 1000);

        return {
            allowed: false,
            error: `Rate limit exceeded: ${currentRph}/${rate_limit_rph} requests per hour`,
            retryAfter: Math.max(1, retryAfter),
            current: { rpm: currentRpm, rph: currentRph }
        };
    }

    return {
        allowed: true,
        error: null,
        retryAfter: null,
        current: { rpm: currentRpm, rph: currentRph }
    };
}

/**
 * Record a request for rate limiting
 * Call this AFTER the request is processed (success or failure)
 *
 * @param {string} keyId - The API key ID
 */
export function recordRequest(keyId) {
    const now = Date.now();
    const data = getRateLimitData(keyId);

    data.rpm.push(now);
    data.rph.push(now);
}

/**
 * Get current rate limit status for a key
 * @param {Object} keyEntry - The API key entry
 * @returns {Object} Current rate limit status
 */
export function getRateLimitStatus(keyEntry) {
    const { id, rate_limit_rpm, rate_limit_rph } = keyEntry;

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const data = getRateLimitData(id);

    // Clean up and count
    data.rpm = data.rpm.filter(ts => ts > oneMinuteAgo);
    data.rph = data.rph.filter(ts => ts > oneHourAgo);

    return {
        rpm: {
            current: data.rpm.length,
            limit: rate_limit_rpm,
            remaining: rate_limit_rpm ? Math.max(0, rate_limit_rpm - data.rpm.length) : null
        },
        rph: {
            current: data.rph.length,
            limit: rate_limit_rph,
            remaining: rate_limit_rph ? Math.max(0, rate_limit_rph - data.rph.length) : null
        }
    };
}

/**
 * Reset rate limits for a key (for testing or admin purposes)
 * @param {string} keyId - The API key ID
 */
export function resetRateLimit(keyId) {
    rateLimitStore.delete(keyId);
}

/**
 * Get all rate limit data (for debugging)
 * @returns {Object} All rate limit data
 */
export function getAllRateLimits() {
    const result = {};
    for (const [keyId, data] of rateLimitStore.entries()) {
        result[keyId] = {
            rpm: data.rpm.length,
            rph: data.rph.length
        };
    }
    return result;
}
