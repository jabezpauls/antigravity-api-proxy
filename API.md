# Antigravity API Proxy - API Documentation

Complete reference for all API endpoints, authentication, and usage patterns.

---

## Table of Contents

- [Authentication](#authentication)
- [Chat Completions (OpenAI Format)](#chat-completions-openai-format)
- [Messages (Anthropic Format)](#messages-anthropic-format)
- [Models](#models)
- [API Keys Management](#api-keys-management)
- [Request Logs](#request-logs)
- [Accounts](#accounts)
- [Server Management](#server-management)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Best Practices](#best-practices)

---

## Authentication

All API requests require an API key. Generate one via the Web UI (`http://localhost:8080` → **API Keys** → **Create Key**).

### Header Formats

**OpenAI style (recommended):**
```
Authorization: Bearer sk-ag-your-key-here
```

**Anthropic style:**
```
x-api-key: sk-ag-your-key-here
```

Both formats work on all endpoints.

### Example

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-c8f4dc927b79dcbea8dfd715978a5855" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-3-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## Chat Completions (OpenAI Format)

OpenAI-compatible endpoint for chat completions. Works with any OpenAI SDK or client.

### Endpoint

```
POST /v1/chat/completions
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model ID (see [Available Models](#available-models)) |
| `messages` | array | Yes | Array of message objects |
| `max_tokens` | integer | No | Maximum tokens to generate (default: 4096) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 1) |
| `top_p` | number | No | Nucleus sampling threshold (default: 1) |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `stop` | string/array | No | Stop sequences |
| `n` | integer | No | Number of completions (only 1 supported) |

### Message Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | `system`, `user`, or `assistant` |
| `content` | string/array | Yes | Message content (text or multimodal) |
| `name` | string | No | Optional name for the participant |

### Non-Streaming Request

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is 2+2?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### Non-Streaming Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704067200,
  "model": "gemini-3-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "2 + 2 equals 4."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 8,
    "total_tokens": 33
  }
}
```

### Streaming Request

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'
```

### Streaming Response (SSE)

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gemini-3-flash","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gemini-3-flash","choices":[{"index":0,"delta":{"content":"Silent"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gemini-3-flash","choices":[{"index":0,"delta":{"content":" pond"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"gemini-3-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Python Example (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="sk-ag-your-key"
)

# Non-streaming
response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    max_tokens=500
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Write a story"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:8080/v1',
    apiKey: 'sk-ag-your-key'
});

// Non-streaming
const response = await client.chat.completions.create({
    model: 'gemini-3-flash',
    messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
    model: 'gemini-3-flash',
    messages: [{ role: 'user', content: 'Write a poem' }],
    stream: true
});
for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

## Messages (Anthropic Format)

Anthropic-compatible endpoint. Works with the Anthropic SDK.

### Endpoint

```
POST /v1/messages
```

### Required Headers

```
Content-Type: application/json
anthropic-version: 2023-06-01
x-api-key: sk-ag-your-key
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model ID |
| `messages` | array | Yes | Array of message objects |
| `max_tokens` | integer | Yes | Maximum tokens to generate |
| `system` | string | No | System prompt |
| `temperature` | number | No | Sampling temperature 0-1 |
| `top_p` | number | No | Nucleus sampling |
| `top_k` | integer | No | Top-k sampling |
| `stream` | boolean | No | Enable streaming |
| `stop_sequences` | array | No | Stop sequences |
| `metadata` | object | No | Request metadata |

### Request Example

```bash
curl http://localhost:8080/v1/messages \
  -H "x-api-key: sk-ag-your-key" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gemini-3-flash",
    "max_tokens": 1024,
    "system": "You are a helpful coding assistant.",
    "messages": [
      {"role": "user", "content": "Write a Python function to reverse a string"}
    ]
  }'
```

### Response

```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Here's a Python function to reverse a string:\n\n```python\ndef reverse_string(s):\n    return s[::-1]\n```"
    }
  ],
  "model": "gemini-3-flash",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 45,
    "output_tokens": 32
  }
}
```

### Thinking Models

Models with `-thinking` suffix return thinking blocks:

```json
{
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me analyze this step by step..."
    },
    {
      "type": "text",
      "text": "The answer is 42."
    }
  ]
}
```

### Python Example (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:8080",
    api_key="sk-ag-your-key"
)

# Non-streaming
response = client.messages.create(
    model="gemini-3-flash",
    max_tokens=1024,
    system="You are a helpful assistant.",
    messages=[
        {"role": "user", "content": "Explain recursion"}
    ]
)
print(response.content[0].text)

# Streaming
with client.messages.stream(
    model="gemini-3-flash",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a story"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Multi-turn Conversation

```python
messages = [
    {"role": "user", "content": "My name is Alice."},
    {"role": "assistant", "content": "Hello Alice! Nice to meet you."},
    {"role": "user", "content": "What's my name?"}
]

response = client.messages.create(
    model="gemini-3-flash",
    max_tokens=100,
    messages=messages
)
# Response: "Your name is Alice."
```

---

## Models

### List Models

```
GET /v1/models
```

Returns available models in OpenAI format.

```bash
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer sk-ag-your-key"
```

**Response:**

```json
{
  "object": "list",
  "data": [
    {"id": "gemini-3-flash", "object": "model", "owned_by": "google"},
    {"id": "gemini-3-pro-high", "object": "model", "owned_by": "google"},
    {"id": "claude-sonnet-4-5", "object": "model", "owned_by": "anthropic"},
    {"id": "claude-opus-4-5-thinking", "object": "model", "owned_by": "anthropic"}
  ]
}
```

### Available Models

| Model ID | Provider | Description | Best For |
|----------|----------|-------------|----------|
| `gemini-3-flash` | Google | Fast, efficient | General tasks, quick responses |
| `gemini-3-pro-low` | Google | Pro quality | Complex tasks, lower quota |
| `gemini-3-pro-high` | Google | Pro with higher limits | Heavy usage |
| `gemini-2.5-flash` | Google | Gemini 2.5 | Balanced performance |
| `gemini-2.5-flash-lite` | Google | Lightweight | High volume, low cost |
| `gemini-2.5-pro` | Google | Premium | Best quality |
| `claude-sonnet-4-5` | Anthropic | Claude Sonnet | Coding, analysis |
| `claude-sonnet-4-5-thinking` | Anthropic | With thinking | Complex reasoning |
| `claude-opus-4-5-thinking` | Anthropic | Claude Opus | Most capable |

### OpenAI Model Mapping

Use familiar OpenAI model names - they're automatically mapped:

| OpenAI Name | Maps To |
|-------------|---------|
| `gpt-4` | `claude-opus-4-5-thinking` |
| `gpt-4-turbo` | `claude-opus-4-5-thinking` |
| `gpt-4o` | `gemini-3-pro-high` |
| `gpt-3.5-turbo` | `gemini-3-flash` |
| `o1` | `claude-opus-4-5-thinking` |
| `o1-mini` | `claude-sonnet-4-5-thinking` |

---

## API Keys Management

### List All Keys

```
GET /api/keys
```

```bash
curl http://localhost:8080/api/keys
```

**Response:**

```json
{
  "status": "ok",
  "keys": [
    {
      "id": "uuid-here",
      "name": "Production Key",
      "key_prefix": "sk-ag-c8f4****5855",
      "allowed_models": ["gemini-*"],
      "rate_limit_rpm": 60,
      "rate_limit_rph": 1000,
      "ip_whitelist": null,
      "expires_at": null,
      "enabled": true,
      "created_at": 1704067200000,
      "last_used_at": 1704153600000,
      "request_count": 150
    }
  ]
}
```

### Create Key

```
POST /api/keys
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the key |
| `allowed_models` | array | No | Model patterns (e.g., `["gemini-*", "claude-sonnet-*"]`) |
| `rate_limit_rpm` | integer | No | Max requests per minute |
| `rate_limit_rph` | integer | No | Max requests per hour |
| `ip_whitelist` | array | No | Allowed IP patterns (e.g., `["192.168.1.*"]`) |
| `expires_at` | integer | No | Unix timestamp for expiration |
| `notes` | string | No | Optional notes |

```bash
curl -X POST http://localhost:8080/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API",
    "allowed_models": ["gemini-3-flash", "gemini-3-pro-*"],
    "rate_limit_rpm": 60,
    "rate_limit_rph": 1000,
    "ip_whitelist": ["10.0.0.*", "192.168.1.100"],
    "expires_at": 1735689600,
    "notes": "For production server"
  }'
```

**Response:**

```json
{
  "status": "ok",
  "key": {
    "id": "uuid-here",
    "key": "sk-ag-c8f4dc927b79dcbea8dfd715978a5855",
    "name": "Production API",
    "key_prefix": "sk-ag-c8f4****5855"
  }
}
```

> **Important:** The full key is only returned once at creation. Store it securely.

### Update Key

```
PATCH /api/keys/:id
```

```bash
curl -X PATCH http://localhost:8080/api/keys/uuid-here \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "enabled": false,
    "rate_limit_rpm": 30
  }'
```

### Delete Key

```
DELETE /api/keys/:id
```

```bash
curl -X DELETE http://localhost:8080/api/keys/uuid-here
```

### Regenerate Key

```
POST /api/keys/:id/regenerate
```

Generates a new key value while keeping all settings. The old key stops working immediately.

```bash
curl -X POST http://localhost:8080/api/keys/uuid-here/regenerate
```

### Model Pattern Matching

The `allowed_models` field supports glob patterns:

| Pattern | Matches |
|---------|---------|
| `gemini-*` | All Gemini models |
| `claude-*` | All Claude models |
| `gemini-3-*` | `gemini-3-flash`, `gemini-3-pro-low`, `gemini-3-pro-high` |
| `*-thinking` | All thinking models |
| `gemini-3-flash` | Exact match only |

---

## Request Logs

Every API request is logged with full content for debugging and auditing.

### List Logs

```
GET /api/logs/requests
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `api_key_id` | string | Filter by API key ID |
| `model` | string | Filter by model |
| `status` | string | `success`, `error`, or `rate_limited` |
| `from` | integer | Start timestamp (Unix ms) |
| `to` | integer | End timestamp (Unix ms) |
| `search` | string | Search in content |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 50, max: 100) |

```bash
# Get recent logs
curl "http://localhost:8080/api/logs/requests?limit=10"

# Filter by model and status
curl "http://localhost:8080/api/logs/requests?model=gemini-3-flash&status=success"

# Search in content
curl "http://localhost:8080/api/logs/requests?search=python"

# Date range
curl "http://localhost:8080/api/logs/requests?from=1704067200000&to=1704153600000"
```

**Response:**

```json
{
  "status": "ok",
  "logs": [
    {
      "id": "log-uuid",
      "api_key_id": "key-uuid",
      "api_key_name": "Production Key",
      "api_key_prefix": "sk-ag-c8f4****5855",
      "timestamp": 1704153600000,
      "model": "gemini-3-flash",
      "actual_model": "gemini-3-flash",
      "input_tokens": 45,
      "output_tokens": 120,
      "duration_ms": 1250,
      "status": "success",
      "http_status": 200,
      "client_ip": "192.168.1.100",
      "user_agent": "python-requests/2.28.0"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25
  }
}
```

### Get Single Log (Full Content)

```
GET /api/logs/requests/:id
```

```bash
curl http://localhost:8080/api/logs/requests/log-uuid
```

**Response:**

```json
{
  "status": "ok",
  "log": {
    "id": "log-uuid",
    "api_key_id": "key-uuid",
    "timestamp": 1704153600000,
    "model": "gemini-3-flash",
    "request_messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Write a haiku about programming"}
    ],
    "request_system": "You are a helpful assistant.",
    "response_content": [
      {
        "type": "text",
        "text": "Code flows like water\nBugs emerge then disappear\nShip it, deploy, pray"
      }
    ],
    "input_tokens": 45,
    "output_tokens": 28,
    "duration_ms": 890,
    "status": "success",
    "error_message": null,
    "http_status": 200,
    "client_ip": "192.168.1.100",
    "user_agent": "python-requests/2.28.0"
  }
}
```

### Delete Log

```
DELETE /api/logs/requests/:id
```

### Clear Logs

```
POST /api/logs/requests/clear
```

**Request Body:**

```json
{
  "before": 1704067200000,
  "api_key_id": "optional-key-uuid"
}
```

### Export Logs

```
GET /api/logs/requests/export
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `json` or `csv` (default: json) |
| `api_key_id` | string | Filter by key |
| `from` | integer | Start timestamp |
| `to` | integer | End timestamp |

```bash
# Export as JSON
curl "http://localhost:8080/api/logs/requests/export?format=json" > logs.json

# Export as CSV
curl "http://localhost:8080/api/logs/requests/export?format=csv" > logs.csv
```

---

## Accounts

Manage Google accounts linked to the proxy.

### List Accounts

```
GET /api/accounts
```

```bash
curl http://localhost:8080/api/accounts
```

**Response:**

```json
{
  "status": "ok",
  "accounts": [
    {
      "email": "user@gmail.com",
      "enabled": true,
      "subscription": {
        "tier": "pro",
        "projectId": "project-123"
      },
      "lastUsed": 1704153600000,
      "isInvalid": false
    }
  ]
}
```

### Get Account Limits

```
GET /account-limits
```

**Query Parameters:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `format` | `table` | ASCII table output |
| `format` | `json` | JSON output (default) |

```bash
# JSON format
curl http://localhost:8080/account-limits

# ASCII table
curl "http://localhost:8080/account-limits?format=table"
```

**JSON Response:**

```json
{
  "accounts": [
    {
      "email": "user@gmail.com",
      "subscription": {"tier": "pro"},
      "limits": {
        "gemini-3-flash": {"remainingFraction": 0.85, "resetTime": "2024-01-02T00:00:00Z"},
        "claude-sonnet-4-5": {"remainingFraction": 0.92, "resetTime": "2024-01-02T00:00:00Z"}
      }
    }
  ],
  "models": ["gemini-3-flash", "gemini-3-pro-high", "claude-sonnet-4-5"]
}
```

### Refresh Account Token

```
POST /api/accounts/:email/refresh
```

```bash
curl -X POST http://localhost:8080/api/accounts/user@gmail.com/refresh
```

### Toggle Account

```
PATCH /api/accounts/:email
```

```bash
curl -X PATCH http://localhost:8080/api/accounts/user@gmail.com \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Delete Account

```
DELETE /api/accounts/:email
```

```bash
curl -X DELETE http://localhost:8080/api/accounts/user@gmail.com
```

---

## Server Management

### Health Check

```
GET /health
```

```bash
curl http://localhost:8080/health
```

**Response:**

```json
{
  "status": "ok",
  "uptime": 3600,
  "accounts": 2,
  "activeAccounts": 2
}
```

### Force Token Refresh

```
POST /refresh-token
```

Refreshes OAuth tokens for all accounts.

```bash
curl -X POST http://localhost:8080/refresh-token
```

### Server Config

```
GET /api/config
```

```bash
curl http://localhost:8080/api/config
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "type": "error",
  "error": {
    "type": "error_type",
    "message": "Human-readable error message"
  }
}
```

### Error Types

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | `invalid_request_error` | Malformed request |
| 401 | `authentication_error` | Invalid or missing API key |
| 403 | `permission_error` | Model not allowed for this key |
| 404 | `not_found_error` | Resource not found |
| 429 | `rate_limit_error` | Rate limit exceeded |
| 500 | `api_error` | Internal server error |
| 503 | `overloaded_error` | All accounts rate limited |

### Common Errors

**Invalid API Key:**
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Invalid API key"
  }
}
```

**Model Not Allowed:**
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Model claude-opus-4-5 is not allowed for this API key"
  }
}
```

**Rate Limited:**
```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Try again in 45 seconds."
  }
}
```

### Handling Errors in Code

**Python:**
```python
from openai import OpenAI, APIError, RateLimitError

client = OpenAI(base_url="http://localhost:8080/v1", api_key="sk-ag-...")

try:
    response = client.chat.completions.create(
        model="gemini-3-flash",
        messages=[{"role": "user", "content": "Hello"}]
    )
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after}")
except APIError as e:
    print(f"API error: {e.message}")
```

**JavaScript:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({ baseURL: 'http://localhost:8080/v1', apiKey: 'sk-ag-...' });

try {
    const response = await client.chat.completions.create({
        model: 'gemini-3-flash',
        messages: [{ role: 'user', content: 'Hello' }]
    });
} catch (error) {
    if (error.status === 429) {
        console.log('Rate limited, retrying...');
    } else {
        console.error('Error:', error.message);
    }
}
```

---

## Rate Limits

### API Key Rate Limits

Set per-key limits when creating keys:

- **RPM (Requests Per Minute)**: Sliding window, resets continuously
- **RPH (Requests Per Hour)**: Sliding window, resets continuously

### Account Rate Limits

Google Antigravity has its own rate limits per account. The proxy:

1. Tracks rate limit responses from Google
2. Automatically switches to another account when limited
3. Marks accounts as "cooling down" until reset time

### Rate Limit Headers

Responses include rate limit info:

```
X-RateLimit-Limit-Requests: 60
X-RateLimit-Remaining-Requests: 45
X-RateLimit-Reset-Requests: 2024-01-01T12:01:00Z
```

### Retry Strategy

Recommended exponential backoff:

```python
import time
import random

def request_with_retry(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            wait = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait)
```

---

## Best Practices

### 1. Use Appropriate Models

| Task | Recommended Model |
|------|-------------------|
| Quick responses, chat | `gemini-3-flash` |
| Code generation | `claude-sonnet-4-5` |
| Complex reasoning | `claude-opus-4-5-thinking` |
| High volume, low cost | `gemini-2.5-flash-lite` |

### 2. Optimize Token Usage

```python
# Be specific in system prompts
system = "You are a Python expert. Give concise code examples."

# Limit response length
response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[...],
    max_tokens=500  # Prevent runaway responses
)
```

### 3. Use Streaming for Long Responses

```python
# Better UX for long generations
stream = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Write a detailed guide"}],
    stream=True
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

### 4. Handle Errors Gracefully

```python
from openai import RateLimitError, APIError

try:
    response = client.chat.completions.create(...)
except RateLimitError:
    # Wait and retry, or use fallback
    pass
except APIError as e:
    # Log error, notify user
    logger.error(f"API error: {e}")
```

### 5. Secure Your API Keys

- Never commit keys to version control
- Use environment variables
- Set IP whitelists for production keys
- Rotate keys periodically
- Use separate keys for dev/staging/prod

### 6. Monitor Usage

- Check the Request Logs regularly
- Set up alerts for error spikes
- Review token usage by model
- Track costs per API key

### 7. Multi-Account Strategy

For high throughput:

```bash
# Add multiple accounts
npx @jabezpauls/antigravity-api-proxy accounts add  # Repeat for each account

# Use round-robin for max throughput
npx @jabezpauls/antigravity-api-proxy start --strategy=round-robin
```

### 8. Caching Considerations

For repeated queries, implement client-side caching:

```python
import hashlib
import json

cache = {}

def cached_completion(messages, model="gemini-3-flash"):
    key = hashlib.md5(json.dumps(messages).encode()).hexdigest()
    if key in cache:
        return cache[key]

    response = client.chat.completions.create(
        model=model,
        messages=messages
    )
    cache[key] = response
    return response
```

---

## Quick Reference

### Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/chat/completions` | POST | API Key | OpenAI chat |
| `/v1/messages` | POST | API Key | Anthropic messages |
| `/v1/models` | GET | API Key | List models |
| `/api/keys` | GET/POST | None | Manage API keys |
| `/api/keys/:id` | PATCH/DELETE | None | Update/delete key |
| `/api/logs/requests` | GET | None | View logs |
| `/api/accounts` | GET | None | List accounts |
| `/account-limits` | GET | None | Account quotas |
| `/health` | GET | None | Health check |

### Common Headers

```
Authorization: Bearer sk-ag-your-key
Content-Type: application/json
anthropic-version: 2023-06-01  (for /v1/messages)
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden (model not allowed) |
| 429 | Rate limited |
| 500 | Server error |
| 503 | All accounts unavailable |
