/**
 * OpenAI Model Mapper
 * Maps OpenAI model names to internal model names
 */

// Map of OpenAI model names to internal model names
export const OPENAI_MODEL_MAP = {
    // GPT-4 family → Claude Opus (most capable)
    'gpt-4': 'claude-opus-4-5-thinking',
    'gpt-4-turbo': 'claude-opus-4-5-thinking',
    'gpt-4-turbo-preview': 'claude-opus-4-5-thinking',
    'gpt-4-0125-preview': 'claude-opus-4-5-thinking',
    'gpt-4-1106-preview': 'claude-opus-4-5-thinking',

    // GPT-4o family → Gemini Pro High (multimodal, capable)
    'gpt-4o': 'gemini-3-pro-high',
    'gpt-4o-mini': 'gemini-3-flash',

    // GPT-3.5 family → Gemini Flash (fast, efficient)
    'gpt-3.5-turbo': 'gemini-3-flash',
    'gpt-3.5-turbo-0125': 'gemini-3-flash',
    'gpt-3.5-turbo-1106': 'gemini-3-flash',
    'gpt-3.5-turbo-instruct': 'gemini-3-flash',

    // o1 reasoning models → Claude thinking models
    'o1': 'claude-opus-4-5-thinking',
    'o1-preview': 'claude-opus-4-5-thinking',
    'o1-mini': 'claude-sonnet-4-5-thinking',

    // Claude aliases (passthrough with OpenAI-style names)
    'claude-3-opus': 'claude-opus-4-5-thinking',
    'claude-3-sonnet': 'claude-sonnet-4-5-thinking',
    'claude-3-haiku': 'gemini-3-flash',

    // Gemini aliases
    'gemini-pro': 'gemini-3-pro-high',
    'gemini-flash': 'gemini-3-flash'
};

/**
 * Map an OpenAI model name to an internal model name
 * @param {string} openaiModel - The OpenAI model name
 * @returns {string} The internal model name
 */
export function mapModel(openaiModel) {
    if (!openaiModel) {
        return 'gemini-3-flash'; // Default fallback
    }

    // Check direct mapping first
    const mapped = OPENAI_MODEL_MAP[openaiModel.toLowerCase()];
    if (mapped) {
        return mapped;
    }

    // If it's already an internal model name, pass through
    const lower = openaiModel.toLowerCase();
    if (lower.includes('claude') || lower.includes('gemini')) {
        return openaiModel;
    }

    // Unknown model, default to Gemini Flash
    return openaiModel;
}

/**
 * Get the list of available OpenAI-compatible model names
 * @returns {Array<{id: string, object: string, created: number, owned_by: string}>}
 */
export function getOpenAIModels() {
    const now = Math.floor(Date.now() / 1000);

    return [
        // Primary OpenAI-compatible names
        { id: 'gpt-4', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gpt-4-turbo', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gpt-4o', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gpt-4o-mini', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gpt-3.5-turbo', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'o1', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'o1-mini', object: 'model', created: now, owned_by: 'antigravity' },
        // Internal model names (also available)
        { id: 'claude-opus-4-5-thinking', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'claude-sonnet-4-5-thinking', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gemini-3-pro-high', object: 'model', created: now, owned_by: 'antigravity' },
        { id: 'gemini-3-flash', object: 'model', created: now, owned_by: 'antigravity' }
    ];
}

export default {
    mapModel,
    getOpenAIModels,
    OPENAI_MODEL_MAP
};
