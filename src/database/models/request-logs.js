/**
 * Request Logs Data Model
 * CRUD operations for request logs stored in SQLite
 */

import crypto from 'crypto';
import { getDatabase } from '../index.js';

/**
 * Create a new request log entry
 * @param {Object} log - Log entry data
 * @returns {Object} The created log entry
 */
export function createRequestLog(log) {
    const db = getDatabase();
    const id = crypto.randomUUID();

    const entry = {
        id,
        api_key_id: log.api_key_id,
        timestamp: log.timestamp || Date.now(),
        model: log.model,
        actual_model: log.actual_model || null,
        account_email: log.account_email || null,
        request_messages: JSON.stringify(log.request_messages),
        request_system: log.request_system || null,
        response_content: log.response_content ? JSON.stringify(log.response_content) : null,
        input_tokens: log.input_tokens || null,
        output_tokens: log.output_tokens || null,
        duration_ms: log.duration_ms || null,
        status: log.status,
        error_message: log.error_message || null,
        http_status: log.http_status || null,
        client_ip: log.client_ip || null,
        user_agent: log.user_agent || null
    };

    db.prepare(`
        INSERT INTO request_logs (
            id, api_key_id, timestamp, model, actual_model, account_email,
            request_messages, request_system, response_content,
            input_tokens, output_tokens, duration_ms,
            status, error_message, http_status,
            client_ip, user_agent
        ) VALUES (
            @id, @api_key_id, @timestamp, @model, @actual_model, @account_email,
            @request_messages, @request_system, @response_content,
            @input_tokens, @output_tokens, @duration_ms,
            @status, @error_message, @http_status,
            @client_ip, @user_agent
        )
    `).run(entry);

    return { id, ...entry };
}

/**
 * Get request logs with filtering and pagination
 * @param {Object} options - Query options
 * @param {string} [options.api_key_id] - Filter by API key
 * @param {string} [options.model] - Filter by model
 * @param {string} [options.status] - Filter by status (success/error/rate_limited)
 * @param {number} [options.from] - Start timestamp
 * @param {number} [options.to] - End timestamp
 * @param {string} [options.search] - Search in request/response content
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @returns {Object} { logs: Array, total: number, page: number, pages: number }
 */
export function getRequestLogs(options = {}) {
    const db = getDatabase();

    const {
        api_key_id,
        model,
        status,
        from,
        to,
        search,
        page = 1,
        limit = 50
    } = options;

    const conditions = [];
    const params = {};

    if (api_key_id) {
        conditions.push('rl.api_key_id = @api_key_id');
        params.api_key_id = api_key_id;
    }

    if (model) {
        conditions.push('rl.model = @model');
        params.model = model;
    }

    if (status) {
        conditions.push('rl.status = @status');
        params.status = status;
    }

    if (from) {
        conditions.push('rl.timestamp >= @from');
        params.from = from;
    }

    if (to) {
        conditions.push('rl.timestamp <= @to');
        params.to = to;
    }

    if (search) {
        conditions.push('(rl.request_messages LIKE @search OR rl.response_content LIKE @search)');
        params.search = `%${search}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM request_logs rl ${whereClause}`;
    const { total } = db.prepare(countQuery).get(params);

    // Get paginated results (without full content for list view)
    const offset = (page - 1) * limit;
    params.limit = limit;
    params.offset = offset;

    const logsQuery = `
        SELECT
            rl.id, rl.api_key_id, rl.timestamp, rl.model, rl.actual_model, rl.account_email,
            rl.input_tokens, rl.output_tokens, rl.duration_ms,
            rl.status, rl.error_message, rl.http_status,
            rl.client_ip, rl.user_agent,
            ak.name as api_key_name, ak.key_prefix as api_key_prefix
        FROM request_logs rl
        LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
        ${whereClause}
        ORDER BY rl.timestamp DESC
        LIMIT @limit OFFSET @offset
    `;

    const logs = db.prepare(logsQuery).all(params);

    return {
        logs,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
}

/**
 * Get a single request log by ID (with full content)
 * @param {string} id - The log ID
 * @returns {Object|null} The log entry or null if not found
 */
export function getRequestLogById(id) {
    const db = getDatabase();

    const row = db.prepare(`
        SELECT
            rl.*,
            ak.name as api_key_name, ak.key_prefix as api_key_prefix
        FROM request_logs rl
        LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
        WHERE rl.id = ?
    `).get(id);

    if (!row) return null;

    return {
        ...row,
        request_messages: row.request_messages ? JSON.parse(row.request_messages) : null,
        response_content: row.response_content ? JSON.parse(row.response_content) : null
    };
}

/**
 * Delete a request log
 * @param {string} id - The log ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteRequestLog(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM request_logs WHERE id = ?').run(id);
    return result.changes > 0;
}

/**
 * Clear request logs by date range
 * @param {Object} options - Clear options
 * @param {number} [options.from] - Start timestamp (clear logs after this)
 * @param {number} [options.to] - End timestamp (clear logs before this)
 * @param {string} [options.api_key_id] - Only clear logs for this key
 * @returns {number} Number of deleted records
 */
export function clearRequestLogs(options = {}) {
    const db = getDatabase();

    const { from, to, api_key_id } = options;
    const conditions = [];
    const params = {};

    if (from) {
        conditions.push('timestamp >= @from');
        params.from = from;
    }

    if (to) {
        conditions.push('timestamp <= @to');
        params.to = to;
    }

    if (api_key_id) {
        conditions.push('api_key_id = @api_key_id');
        params.api_key_id = api_key_id;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = db.prepare(`DELETE FROM request_logs ${whereClause}`).run(params);

    return result.changes;
}

/**
 * Get request log statistics
 * @param {Object} options - Stats options
 * @param {string} [options.api_key_id] - Filter by API key
 * @param {number} [options.from] - Start timestamp
 * @param {number} [options.to] - End timestamp
 * @returns {Object} Statistics object
 */
export function getRequestStats(options = {}) {
    const db = getDatabase();

    const { api_key_id, from, to } = options;
    const conditions = [];
    const params = {};

    if (api_key_id) {
        conditions.push('api_key_id = @api_key_id');
        params.api_key_id = api_key_id;
    }

    if (from) {
        conditions.push('timestamp >= @from');
        params.from = from;
    }

    if (to) {
        conditions.push('timestamp <= @to');
        params.to = to;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const stats = db.prepare(`
        SELECT
            COUNT(*) as total_requests,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_requests,
            SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) as rate_limited_requests,
            SUM(COALESCE(input_tokens, 0)) as total_input_tokens,
            SUM(COALESCE(output_tokens, 0)) as total_output_tokens,
            AVG(duration_ms) as avg_duration_ms
        FROM request_logs
        ${whereClause}
    `).get(params);

    // Get per-model breakdown
    const modelStats = db.prepare(`
        SELECT
            model,
            COUNT(*) as requests,
            SUM(COALESCE(input_tokens, 0)) as input_tokens,
            SUM(COALESCE(output_tokens, 0)) as output_tokens
        FROM request_logs
        ${whereClause}
        GROUP BY model
        ORDER BY requests DESC
    `).all(params);

    return {
        ...stats,
        models: modelStats
    };
}

/**
 * Export request logs to CSV format
 * @param {Object} options - Same as getRequestLogs options (without pagination)
 * @returns {string} CSV formatted string
 */
export function exportRequestLogs(options = {}) {
    const db = getDatabase();

    const { api_key_id, model, status, from, to, search } = options;
    const conditions = [];
    const params = {};

    if (api_key_id) {
        conditions.push('rl.api_key_id = @api_key_id');
        params.api_key_id = api_key_id;
    }

    if (model) {
        conditions.push('rl.model = @model');
        params.model = model;
    }

    if (status) {
        conditions.push('rl.status = @status');
        params.status = status;
    }

    if (from) {
        conditions.push('rl.timestamp >= @from');
        params.from = from;
    }

    if (to) {
        conditions.push('rl.timestamp <= @to');
        params.to = to;
    }

    if (search) {
        conditions.push('(rl.request_messages LIKE @search OR rl.response_content LIKE @search)');
        params.search = `%${search}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
        SELECT
            rl.id, rl.timestamp, rl.model, rl.actual_model, rl.account_email,
            rl.input_tokens, rl.output_tokens, rl.duration_ms,
            rl.status, rl.error_message, rl.http_status,
            rl.client_ip, rl.user_agent,
            ak.name as api_key_name
        FROM request_logs rl
        LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
        ${whereClause}
        ORDER BY rl.timestamp DESC
    `).all(params);

    // Build CSV
    const headers = [
        'id', 'timestamp', 'api_key_name', 'model', 'actual_model', 'account_email',
        'input_tokens', 'output_tokens', 'duration_ms', 'status', 'error_message',
        'http_status', 'client_ip', 'user_agent'
    ];

    const csvRows = [headers.join(',')];

    for (const row of rows) {
        const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            // Escape quotes and wrap in quotes if contains comma
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}
