/**
 * OpenAI Streaming Adapter
 * Converts Anthropic SSE stream events to OpenAI Chat Completions streaming format
 *
 * Anthropic format:
 *   event: message_start
 *   data: {"type":"message_start","message":{...}}
 *
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
 *
 * OpenAI format:
 *   data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}
 *   data: [DONE]
 */

import crypto from 'crypto';
import { createStreamChunk, createDoneMarker } from './response-converter.js';

/**
 * Create an OpenAI streaming adapter
 * Transforms Anthropic SSE events to OpenAI format
 *
 * @param {string} model - The model name for the response
 * @returns {Object} Adapter with transform method and state
 */
export function createOpenAIStreamAdapter(model) {
    const completionId = `chatcmpl-${crypto.randomBytes(14).toString('hex')}`;
    let sentRole = false;
    let currentToolIndex = -1;
    const toolCallMap = new Map(); // Map block index to tool call index

    return {
        /**
         * Transform an Anthropic SSE event to OpenAI format
         * @param {Object} event - Parsed Anthropic event
         * @returns {string|null} OpenAI SSE data line or null if skipped
         */
        transform(event) {
            if (!event || !event.type) {
                return null;
            }

            switch (event.type) {
                case 'message_start': {
                    // Send initial chunk with role
                    if (!sentRole) {
                        sentRole = true;
                        const chunk = createStreamChunk({
                            id: completionId,
                            model: model,
                            role: 'assistant'
                        });
                        return `data: ${JSON.stringify(chunk)}\n\n`;
                    }
                    return null;
                }

                case 'content_block_start': {
                    const block = event.content_block;
                    if (!block) return null;

                    if (block.type === 'tool_use') {
                        // Start of a tool call
                        currentToolIndex++;
                        toolCallMap.set(event.index, currentToolIndex);

                        const chunk = createStreamChunk({
                            id: completionId,
                            model: model,
                            toolCalls: [{
                                index: currentToolIndex,
                                id: block.id,
                                type: 'function',
                                function: {
                                    name: block.name,
                                    arguments: ''
                                }
                            }]
                        });
                        return `data: ${JSON.stringify(chunk)}\n\n`;
                    }

                    // For text blocks, just wait for deltas
                    return null;
                }

                case 'content_block_delta': {
                    const delta = event.delta;
                    if (!delta) return null;

                    if (delta.type === 'text_delta') {
                        // Text content delta
                        const chunk = createStreamChunk({
                            id: completionId,
                            model: model,
                            content: delta.text
                        });
                        return `data: ${JSON.stringify(chunk)}\n\n`;
                    }

                    if (delta.type === 'input_json_delta') {
                        // Tool call arguments delta
                        const toolIndex = toolCallMap.get(event.index);
                        if (toolIndex !== undefined) {
                            const chunk = createStreamChunk({
                                id: completionId,
                                model: model,
                                toolCalls: [{
                                    index: toolIndex,
                                    function: {
                                        arguments: delta.partial_json
                                    }
                                }]
                            });
                            return `data: ${JSON.stringify(chunk)}\n\n`;
                        }
                    }

                    if (delta.type === 'thinking_delta') {
                        // Skip thinking blocks in OpenAI format
                        // These are internal reasoning and not part of standard output
                        return null;
                    }

                    return null;
                }

                case 'content_block_stop': {
                    // Block finished, no action needed for OpenAI format
                    return null;
                }

                case 'message_delta': {
                    // Message metadata update (stop_reason, usage)
                    const stopReason = event.delta?.stop_reason;
                    if (stopReason) {
                        let finishReason = 'stop';
                        if (stopReason === 'max_tokens') {
                            finishReason = 'length';
                        } else if (stopReason === 'tool_use') {
                            finishReason = 'tool_calls';
                        }

                        const chunk = createStreamChunk({
                            id: completionId,
                            model: model,
                            finishReason: finishReason
                        });
                        return `data: ${JSON.stringify(chunk)}\n\n`;
                    }
                    return null;
                }

                case 'message_stop': {
                    // End of message, send [DONE]
                    return `data: ${createDoneMarker()}\n\n`;
                }

                case 'ping': {
                    // Keepalive, skip
                    return null;
                }

                case 'error': {
                    // Error event
                    const errorChunk = {
                        error: {
                            message: event.error?.message || 'Unknown error',
                            type: event.error?.type || 'server_error',
                            code: null
                        }
                    };
                    return `data: ${JSON.stringify(errorChunk)}\n\n`;
                }

                default:
                    return null;
            }
        },

        /**
         * Get the completion ID
         * @returns {string}
         */
        getId() {
            return completionId;
        }
    };
}

/**
 * Transform a complete Anthropic SSE stream to OpenAI format
 * Generator function that yields OpenAI SSE lines
 *
 * @param {AsyncIterable} anthropicStream - Anthropic SSE event stream
 * @param {string} model - Model name
 * @yields {string} OpenAI SSE data lines
 */
export async function* transformAnthropicStreamToOpenAI(anthropicStream, model) {
    const adapter = createOpenAIStreamAdapter(model);

    for await (const event of anthropicStream) {
        const result = adapter.transform(event);
        if (result) {
            yield result;
        }
    }
}

export default {
    createOpenAIStreamAdapter,
    transformAnthropicStreamToOpenAI
};
