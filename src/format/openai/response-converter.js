/**
 * OpenAI Response Converter
 * Converts Anthropic Messages API responses to OpenAI Chat Completions format
 */

import crypto from 'crypto';

/**
 * Convert Anthropic response to OpenAI Chat Completions format
 *
 * @param {Object} anthropicResponse - Anthropic format response
 * @param {string} requestModel - The model name from the request (for display)
 * @returns {Object} OpenAI format response
 */
export function convertAnthropicToOpenAI(anthropicResponse, requestModel) {
    const content = anthropicResponse.content || [];

    // Extract text content (skip thinking blocks for OpenAI format)
    const textParts = [];
    const toolCalls = [];

    for (const block of content) {
        if (block.type === 'text') {
            textParts.push(block.text);
        } else if (block.type === 'tool_use') {
            toolCalls.push({
                id: block.id || `call_${crypto.randomBytes(12).toString('hex')}`,
                type: 'function',
                function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input || {})
                }
            });
        }
        // Note: thinking blocks are not included in OpenAI format
        // They are internal reasoning and not part of the standard response
    }

    const textContent = textParts.join('');

    // Build message object
    const message = {
        role: 'assistant',
        content: textContent || null
    };

    // Add tool_calls if present
    if (toolCalls.length > 0) {
        message.tool_calls = toolCalls;
        // When there are tool calls, content can be null
        if (!textContent) {
            message.content = null;
        }
    }

    // Map Anthropic stop_reason to OpenAI finish_reason
    let finishReason = 'stop';
    if (anthropicResponse.stop_reason === 'max_tokens') {
        finishReason = 'length';
    } else if (anthropicResponse.stop_reason === 'tool_use') {
        finishReason = 'tool_calls';
    } else if (anthropicResponse.stop_reason === 'end_turn') {
        finishReason = 'stop';
    }

    // Build usage object
    const usage = anthropicResponse.usage || {};
    const openaiUsage = {
        prompt_tokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0),
        completion_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.output_tokens || 0)
    };

    return {
        id: `chatcmpl-${crypto.randomBytes(14).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestModel,
        choices: [{
            index: 0,
            message: message,
            logprobs: null,
            finish_reason: finishReason
        }],
        usage: openaiUsage,
        system_fingerprint: null
    };
}

/**
 * Create an OpenAI streaming chunk
 *
 * @param {Object} options - Chunk options
 * @param {string} options.id - Completion ID
 * @param {string} options.model - Model name
 * @param {string} [options.content] - Text content delta
 * @param {Array} [options.toolCalls] - Tool calls delta
 * @param {string} [options.finishReason] - Finish reason (only on last chunk)
 * @param {string} [options.role] - Role (only on first chunk)
 * @returns {Object} OpenAI streaming chunk
 */
export function createStreamChunk({
    id,
    model,
    content,
    toolCalls,
    finishReason,
    role
}) {
    const delta = {};

    if (role) {
        delta.role = role;
    }

    if (content !== undefined) {
        delta.content = content;
    }

    if (toolCalls) {
        delta.tool_calls = toolCalls;
    }

    const choice = {
        index: 0,
        delta: delta,
        logprobs: null,
        finish_reason: finishReason || null
    };

    return {
        id: id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model,
        system_fingerprint: null,
        choices: [choice]
    };
}

/**
 * Create the final [DONE] marker for streaming
 * @returns {string} The DONE marker
 */
export function createDoneMarker() {
    return '[DONE]';
}

export default {
    convertAnthropicToOpenAI,
    createStreamChunk,
    createDoneMarker
};
