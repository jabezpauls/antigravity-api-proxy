/**
 * Database Module
 * SQLite database management using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from '../utils/logger.js';
import { runMigrations } from './migrations.js';

// Database location
const CONFIG_DIR = path.join(os.homedir(), '.config', 'antigravity-proxy');
const DB_PATH = path.join(CONFIG_DIR, 'proxy.db');

let db = null;

/**
 * Initialize the database connection and run migrations
 * @returns {Database} The database instance
 */
export function initDatabase() {
    if (db) return db;

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    try {
        db = new Database(DB_PATH);

        // Enable foreign keys and WAL mode for better performance
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');

        // Run migrations
        runMigrations(db);

        logger.info(`[Database] Connected to ${DB_PATH}`);
        return db;
    } catch (error) {
        logger.error('[Database] Failed to initialize:', error);
        throw error;
    }
}

/**
 * Get the database instance
 * @returns {Database} The database instance
 * @throws {Error} If database is not initialized
 */
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        logger.info('[Database] Connection closed');
    }
}

/**
 * Get the database path
 * @returns {string} The database file path
 */
export function getDatabasePath() {
    return DB_PATH;
}

export { DB_PATH, CONFIG_DIR };
