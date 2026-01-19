/**
 * OpenAI Request Converter
 * Converts OpenAI Chat Completions API requests to Anthropic Messages API format
 *
 * The Anthropic format is then converted to Google format by the existing converter.
 * This layered approach maximizes code reuse.
 */

import { mapModel } from './model-mapper.js';
import { logger } from '../../utils/logger.js';

/**
 * Convert OpenAI Chat Completions request to Anthropic Messages format
 *
 * @param {Object} openaiRequest - OpenAI format request
 * @returns {Object} Anthropic format request
 */
export function convertOpenAIToAnthropic(openaiRequest) {
    const {
        model,
        messages,
        max_tokens,
        max_completion_tokens,
        temperature,
        top_p,
        stop,
        stream,
        n,
        presence_penalty,
        frequency_penalty,
        user
    } = openaiRequest;

    // Map OpenAI model to internal model
    const mappedModel = mapModel(model);
    logger.debug(`[OpenAI] Model mapping: ${model} → ${mappedModel}`);

    const anthropicRequest = {
        model: mappedModel,
        messages: [],
        max_tokens: max_tokens || max_completion_tokens || 4096,
        stream: stream || false
    };

    // Extract system message and convert messages
    let systemContent = null;
    const convertedMessages = [];

    for (const msg of messages || []) {
        if (msg.role === 'system') {
            // Accumulate system messages
            if (systemContent === null) {
                systemContent = extractContent(msg.content);
            } else {
                systemContent += '\n\n' + extractContent(msg.content);
            }
        } else if (msg.role === 'user') {
            convertedMessages.push({
                role: 'user',
                content: convertOpenAIContent(msg.content)
            });
        } else if (msg.role === 'assistant') {
            // Handle assistant messages (may include tool_calls in OpenAI format)
            const assistantContent = convertAssistantMessage(msg);
            convertedMessages.push({
                role: 'assistant',
                content: assistantContent
            });
        } else if (msg.role === 'tool') {
            // Convert tool response to user message with tool_result
            // OpenAI uses separate 'tool' role, Anthropic uses tool_result in user message
            convertedMessages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: msg.tool_call_id,
                    content: extractContent(msg.content)
                }]
            });
        } else if (msg.role === 'function') {
            // Legacy function calling (deprecated in OpenAI, but handle for compatibility)
            convertedMessages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: msg.name || 'function',
                    content: extractContent(msg.content)
                }]
            });
        }
    }

    // Set system prompt if present
    if (systemContent) {
        anthropicRequest.system = systemContent;
    }

    // Merge consecutive same-role messages (Anthropic requirement)
    anthropicRequest.messages = mergeConsecutiveMessages(convertedMessages);

    // Optional parameters
    if (temperature !== undefined) {
        anthropicRequest.temperature = temperature;
    }
    if (top_p !== undefined) {
        anthropicRequest.top_p = top_p;
    }
    if (stop) {
        anthropicRequest.stop_sequences = Array.isArray(stop) ? stop : [stop];
    }

    // Note: presence_penalty, frequency_penalty, n are not supported by Anthropic
    // We ignore them silently for compatibility

    return anthropicRequest;
}

/**
 * Extract text content from OpenAI content (string or array)
 * @param {string|Array} content - OpenAI content
 * @returns {string} Text content
 */
function extractContent(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n');
    }
    return '';
}

/**
 * Convert OpenAI content to Anthropic content format
 * @param {string|Array} content - OpenAI content
 * @returns {string|Array} Anthropic content
 */
function convertOpenAIContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        const anthropicContent = [];
        for (const part of content) {
            if (part.type === 'text') {
                anthropicContent.push({
                    type: 'text',
                    text: part.text
                });
            } else if (part.type === 'image_url') {
                // Convert OpenAI image format to Anthropic format
                // Note: This is basic support - full implementation would handle URLs
                const imageUrl = part.image_url?.url || '';
                if (imageUrl.startsWith('data:')) {
                    // Base64 data URL
                    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        anthropicContent.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: match[1],
                                data: match[2]
                            }
                        });
                    }
                }
                // HTTP URLs would need to be fetched - skip for basic implementation
            }
        }
        return anthropicContent.length === 1 && anthropicContent[0].type === 'text'
            ? anthropicContent[0].text
            : anthropicContent;
    }

    return content;
}

/**
 * Convert OpenAI assistant message to Anthropic format
 * Handles tool_calls conversion
 * @param {Object} msg - OpenAI assistant message
 * @returns {Array} Anthropic content blocks
 */
function convertAssistantMessage(msg) {
    const content = [];

    // Add text content if present
    if (msg.content) {
        const text = extractContent(msg.content);
        if (text) {
            content.push({
                type: 'text',
                text: text
            });
        }
    }

    // Convert tool_calls to tool_use blocks
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls) {
            if (toolCall.type === 'function') {
                let args = {};
                try {
                    args = JSON.parse(toolCall.function.arguments || '{}');
                } catch {
                    args = { raw: toolCall.function.arguments };
                }

                content.push({
                    type: 'tool_use',
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: args
                });
            }
        }
    }

    // Legacy function_call support
    if (msg.function_call) {
        let args = {};
        try {
            args = JSON.parse(msg.function_call.arguments || '{}');
        } catch {
            args = { raw: msg.function_call.arguments };
        }

        content.push({
            type: 'tool_use',
            id: msg.function_call.name || 'function',
            name: msg.function_call.name,
            input: args
        });
    }

    // Return as array or string depending on content
    if (content.length === 0) {
        return '';
    }
    if (content.length === 1 && content[0].type === 'text') {
        return content[0].text;
    }
    return content;
}

/**
 * Merge consecutive messages with the same role
 * Anthropic API requires alternating user/assistant messages
 * @param {Array} messages - Array of messages
 * @returns {Array} Merged messages
 */
function mergeConsecutiveMessages(messages) {
    if (messages.length === 0) return [];

    const merged = [];
    let current = null;

    for (const msg of messages) {
        if (current && current.role === msg.role) {
            // Merge content
            current.content = mergeContent(current.content, msg.content);
        } else {
            if (current) {
                merged.push(current);
            }
            current = { ...msg };
        }
    }

    if (current) {
        merged.push(current);
    }

    return merged;
}

/**
 * Merge two content values
 * @param {string|Array} a - First content
 * @param {string|Array} b - Second content
 * @returns {string|Array} Merged content
 */
function mergeContent(a, b) {
    const arrA = Array.isArray(a) ? a : (a ? [{ type: 'text', text: a }] : []);
    const arrB = Array.isArray(b) ? b : (b ? [{ type: 'text', text: b }] : []);
    return [...arrA, ...arrB];
}

export default {
    convertOpenAIToAnthropic
};
