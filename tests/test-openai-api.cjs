/**
 * OpenAI API Compatibility Test
 *
 * Tests the OpenAI-compatible `/v1/chat/completions` endpoint.
 *
 * Tests:
 * 1. Non-streaming chat completion
 * 2. Streaming chat completion
 * 3. Model name mapping (gpt-4 -> internal model)
 * 4. OpenAI models list endpoint
 *
 * Requires server to be running on port 8080.
 */
const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

/**
 * Make a non-streaming request to OpenAI chat completions endpoint
 */
function makeOpenAIRequest(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            host: BASE_URL,
            port: PORT,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test',
                'Content-Length': Buffer.byteLength(data)
            }
        }, res => {
            let fullData = '';
            res.on('data', chunk => fullData += chunk.toString());
            res.on('end', () => {
                try {
                    const json = JSON.parse(fullData);
                    resolve({ data: json, statusCode: res.statusCode, raw: fullData });
                } catch (e) {
                    resolve({ error: e.message, statusCode: res.statusCode, raw: fullData });
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Make a streaming request to OpenAI chat completions endpoint
 */
function makeOpenAIStreamRequest(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ ...body, stream: true });
        const req = http.request({
            host: BASE_URL,
            port: PORT,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test',
                'Content-Length': Buffer.byteLength(data)
            }
        }, res => {
            const chunks = [];
            let fullData = '';

            res.on('data', chunk => {
                fullData += chunk.toString();
            });

            res.on('end', () => {
                // Parse SSE chunks
                const lines = fullData.split('\n').filter(l => l.startsWith('data: '));
                for (const line of lines) {
                    const content = line.replace('data: ', '').trim();
                    if (content === '[DONE]') {
                        chunks.push({ done: true });
                    } else {
                        try {
                            chunks.push(JSON.parse(content));
                        } catch (e) {
                            // Skip unparseable chunks
                        }
                    }
                }

                resolve({ chunks, statusCode: res.statusCode, raw: fullData });
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Get OpenAI models list
 */
function getOpenAIModels() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: BASE_URL,
            port: PORT,
            path: '/v1/models/openai',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer test'
            }
        }, res => {
            let fullData = '';
            res.on('data', chunk => fullData += chunk.toString());
            res.on('end', () => {
                try {
                    resolve({ data: JSON.parse(fullData), statusCode: res.statusCode });
                } catch (e) {
                    resolve({ error: e.message, statusCode: res.statusCode, raw: fullData });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('OPENAI API COMPATIBILITY TEST');
    console.log('='.repeat(60));
    console.log('');

    const results = [];
    let allPassed = true;

    // ===== TEST 1: Non-streaming chat completion =====
    console.log('TEST 1: Non-streaming chat completion (gpt-4)');
    console.log('-'.repeat(40));

    try {
        const res1 = await makeOpenAIRequest({
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Say "hello" and nothing else.' }
            ],
            max_tokens: 100
        });

        if (res1.statusCode === 200 && res1.data) {
            const hasId = res1.data.id?.startsWith('chatcmpl-');
            const hasChoices = Array.isArray(res1.data.choices) && res1.data.choices.length > 0;
            const hasContent = res1.data.choices?.[0]?.message?.content;
            const hasFinishReason = res1.data.choices?.[0]?.finish_reason;
            const hasUsage = res1.data.usage?.total_tokens > 0;

            console.log(`  Status: ${res1.statusCode}`);
            console.log(`  ID: ${hasId ? 'OK' : 'MISSING'} (${res1.data.id})`);
            console.log(`  Choices: ${hasChoices ? 'OK' : 'MISSING'}`);
            console.log(`  Content: ${hasContent ? 'OK' : 'MISSING'}`);
            console.log(`  Finish Reason: ${hasFinishReason || 'MISSING'}`);
            console.log(`  Usage: ${hasUsage ? 'OK' : 'MISSING'} (${res1.data.usage?.total_tokens} tokens)`);

            if (hasContent) {
                console.log(`  Response: "${res1.data.choices[0].message.content.substring(0, 100)}"`);
            }

            const passed = hasId && hasChoices && hasContent && hasFinishReason;
            results.push({ name: 'Non-streaming chat completion', passed });
            if (!passed) allPassed = false;
        } else {
            console.log(`  ERROR: ${res1.error || `Status ${res1.statusCode}`}`);
            results.push({ name: 'Non-streaming chat completion', passed: false });
            allPassed = false;
        }
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
        results.push({ name: 'Non-streaming chat completion', passed: false });
        allPassed = false;
    }
    console.log('');

    // ===== TEST 2: Streaming chat completion =====
    console.log('TEST 2: Streaming chat completion (gpt-3.5-turbo)');
    console.log('-'.repeat(40));

    try {
        const res2 = await makeOpenAIStreamRequest({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'user', content: 'Count from 1 to 3.' }
            ],
            max_tokens: 100
        });

        if (res2.statusCode === 200 && res2.chunks.length > 0) {
            const hasDataChunks = res2.chunks.some(c => c.choices?.[0]?.delta?.content);
            const hasDone = res2.chunks.some(c => c.done);
            const hasId = res2.chunks.some(c => c.id?.startsWith('chatcmpl-'));

            // Collect all content
            let fullContent = '';
            for (const chunk of res2.chunks) {
                if (chunk.choices?.[0]?.delta?.content) {
                    fullContent += chunk.choices[0].delta.content;
                }
            }

            console.log(`  Status: ${res2.statusCode}`);
            console.log(`  Chunks: ${res2.chunks.length}`);
            console.log(`  Has ID: ${hasId ? 'OK' : 'MISSING'}`);
            console.log(`  Has Data: ${hasDataChunks ? 'OK' : 'MISSING'}`);
            console.log(`  Has DONE: ${hasDone ? 'OK' : 'MISSING'}`);
            console.log(`  Content: "${fullContent.substring(0, 100)}"`);

            const passed = hasDataChunks && hasDone && hasId;
            results.push({ name: 'Streaming chat completion', passed });
            if (!passed) allPassed = false;
        } else {
            console.log(`  ERROR: No chunks received or status ${res2.statusCode}`);
            results.push({ name: 'Streaming chat completion', passed: false });
            allPassed = false;
        }
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
        results.push({ name: 'Streaming chat completion', passed: false });
        allPassed = false;
    }
    console.log('');

    // ===== TEST 3: OpenAI models list =====
    console.log('TEST 3: OpenAI models list');
    console.log('-'.repeat(40));

    try {
        const res3 = await getOpenAIModels();

        if (res3.statusCode === 200 && res3.data) {
            const hasObject = res3.data.object === 'list';
            const hasData = Array.isArray(res3.data.data) && res3.data.data.length > 0;
            const hasGpt4 = res3.data.data?.some(m => m.id === 'gpt-4');

            console.log(`  Status: ${res3.statusCode}`);
            console.log(`  Object: ${res3.data.object}`);
            console.log(`  Models: ${res3.data.data?.length || 0}`);
            console.log(`  Has gpt-4: ${hasGpt4 ? 'YES' : 'NO'}`);

            if (res3.data.data?.length > 0) {
                console.log(`  Sample: ${res3.data.data.slice(0, 3).map(m => m.id).join(', ')}...`);
            }

            const passed = hasObject && hasData && hasGpt4;
            results.push({ name: 'OpenAI models list', passed });
            if (!passed) allPassed = false;
        } else {
            console.log(`  ERROR: ${res3.error || `Status ${res3.statusCode}`}`);
            results.push({ name: 'OpenAI models list', passed: false });
            allPassed = false;
        }
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
        results.push({ name: 'OpenAI models list', passed: false });
        allPassed = false;
    }
    console.log('');

    // ===== SUMMARY =====
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    for (const r of results) {
        console.log(`  ${r.passed ? 'PASS' : 'FAIL'} - ${r.name}`);
    }
    console.log('');
    console.log(`Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log('');

    process.exit(allPassed ? 0 : 1);
}

runTests().catch(e => {
    console.error('Test error:', e);
    process.exit(1);
});
