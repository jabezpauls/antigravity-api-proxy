/**
 * API Keys Module
 * Advanced API key management with validation, rate limiting, and restrictions
 */

// Database operations
export {
    generateApiKey,
    hashApiKey,
    getKeyPrefix,
    createApiKey,
    listApiKeys,
    getApiKeyById,
    findApiKeyByHash,
    updateApiKey,
    deleteApiKey,
    regenerateApiKey,
    recordApiKeyUsage,
    hasApiKeys
} from '../database/models/api-keys.js';

// Validation
export {
    validateApiKey,
    extractApiKey,
    matchModelPattern,
    isModelAllowed,
    matchIpPattern,
    isIpAllowed
} from './validator.js';

// Rate limiting
export {
    checkRateLimit,
    recordRequest,
    getRateLimitStatus,
    resetRateLimit,
    getAllRateLimits
} from './rate-limiter.js';
