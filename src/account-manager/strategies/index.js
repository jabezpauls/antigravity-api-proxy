/**
 * Strategy Factory (Simplified)
 *
 * Uses only round-robin strategy for account selection.
 */

import { RoundRobinStrategy } from './round-robin-strategy.js';
import { logger } from '../../utils/logger.js';

// Only round-robin is supported
export const STRATEGY_NAMES = ['round-robin'];
export const DEFAULT_STRATEGY = 'round-robin';

/**
 * Create a strategy instance (always returns RoundRobinStrategy)
 * @param {string} strategyName - Ignored, always uses round-robin
 * @param {Object} config - Strategy configuration
 * @returns {RoundRobinStrategy} The strategy instance
 */
export function createStrategy(strategyName, config = {}) {
    logger.debug('[Strategy] Creating RoundRobinStrategy');
    return new RoundRobinStrategy(config);
}

/**
 * Check if a strategy name is valid
 * @param {string} name - Strategy name to check
 * @returns {boolean} True if valid (only round-robin)
 */
export function isValidStrategy(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower === 'round-robin' || lower === 'roundrobin';
}

/**
 * Get the display label for a strategy
 * @param {string} name - Strategy name
 * @returns {string} Display label
 */
export function getStrategyLabel(name) {
    return 'Round Robin (Load Balanced)';
}

// Re-export strategies for direct use
export { RoundRobinStrategy } from './round-robin-strategy.js';
export { BaseStrategy } from './base-strategy.js';
