# Antigravity API Proxy

A self-hosted API proxy that exposes Google Antigravity (Cloud Code) as OpenAI and Anthropic compatible endpoints. Use Claude and Gemini models with any application that supports standard AI APIs.

```
Your App  ───▶  Antigravity API Proxy  ───▶  Google Antigravity (Cloud Code)
                   (localhost:8080)
```

## Features

- **OpenAI Compatible** - `/v1/chat/completions` endpoint works with any OpenAI SDK
- **Anthropic Compatible** - `/v1/messages` endpoint for Anthropic SDK compatibility
- **Multi-Account Support** - Pool multiple Google accounts for higher throughput
- **API Key Management** - Generate keys with rate limits, model restrictions, and expiration
- **Image Generation** - Generate images with `gemini-3-pro-image` model
- **Request Logging** - Full prompt/response history for debugging
- **Web Dashboard** - Manage accounts, keys, and monitor usage

---

## Installation

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/jabezpauls/antigravity-api-proxy.git
cd antigravity-api-proxy
docker compose up -d
```

**Docker commands:**
```bash
docker compose up -d       # Start
docker compose down        # Stop
docker compose restart     # Restart
docker logs -f antigravity-proxy  # View logs
```

### Option 2: Manual

```bash
git clone https://github.com/jabezpauls/antigravity-api-proxy.git
cd antigravity-api-proxy
npm install
npm start
```

Server runs on `http://localhost:8080`.

---

## Quick Start

### 1. Start the Proxy

```bash
docker compose up -d
```

### 2. Add Your Google Account

Open `http://localhost:8080` in your browser, go to **Accounts**, and click **Add Account**. Complete the Google OAuth flow.

### 3. Create an API Key

Go to **API Keys** → **Create Key**. Copy the generated key (starts with `sk-ag-`).

### 4. Use the API

**OpenAI format:**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
```

**Anthropic format:**
```bash
curl http://localhost:8080/v1/messages \
  -H "Authorization: Bearer sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "gemini-3-flash", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello!"}]}'
```

---

## Available Models

### Gemini Models
| Model | Description | Status |
|-------|-------------|--------|
| `gemini-3-flash` | Fast, good for most tasks | ✓ Working |
| `gemini-3-pro-low` | Pro quality, lower quota usage | ✓ Working |
| `gemini-3-pro-high` | Pro quality, higher limits | ✓ Working |
| `gemini-3-pro-image` | Image generation support | ✓ Working |
| `gemini-2.5-flash-lite` | Cheapest option | ✓ Working |
| `gemini-2.5-flash` | Gemini 2.5 Flash | ✗ Broken |
| `gemini-2.5-flash-thinking` | With extended thinking | ✗ Broken |
| `gemini-2.5-pro` | Gemini 2.5 Pro | ✗ Broken |

### Claude Models
| Model | Description | Status |
|-------|-------------|--------|
| `claude-opus-4-5-thinking` | Claude Opus with thinking | ✓ Working |
| `claude-sonnet-4-5-thinking` | With extended thinking | ✓ Working |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 | ✗ Broken |

### OpenAI Model Aliases
| Use This | Maps To |
|----------|---------|
| `gpt-4` | `claude-opus-4-5-thinking` |
| `gpt-4o` | `gemini-3-pro-high` |
| `gpt-3.5-turbo` | `gemini-3-flash` |

> **Note:** Models marked "Broken" are currently not working. Gemini 3.x models generally have better availability.

---

## SDK Examples

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="sk-ag-your-key-here"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### Python (Anthropic SDK)

```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:8080",
    api_key="sk-ag-your-key-here"
)

response = client.messages.create(
    model="gemini-3-flash",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content[0].text)
```

### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'sk-ag-your-key-here'
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.choices[0].message.content);
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="sk-ag-your-key-here",
    model="gpt-4"
)

response = llm.invoke("Hello!")
print(response.content)
```

---

## Image Generation

Generate images using the `gemini-3-pro-image` model:

```bash
curl http://localhost:8080/v1/messages \
  -H "Authorization: Bearer sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gemini-3-pro-image",
    "max_tokens": 4096,
    "messages": [{"role": "user", "content": "Generate an image of a sunset over mountains"}]
  }'
```

The response includes base64-encoded image data in the `content` array.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/messages` | POST | Anthropic-compatible messages |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check |
| `/account-limits` | GET | Account quotas |
| `/api/keys` | GET/POST | Manage API keys |
| `/api/logs/requests` | GET | View request logs |

---

## API Key Features

Create keys with restrictions via Web UI or API:

```bash
curl -X POST http://localhost:8080/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App Key",
    "allowed_models": ["gemini-*"],
    "rate_limit_rpm": 60,
    "expires_at": "2025-12-31"
  }'
```

**Available restrictions:**
- `allowed_models` - Array of allowed model patterns (`gemini-*`, `claude-*`)
- `rate_limit_rpm` - Requests per minute
- `rate_limit_rph` - Requests per hour
- `ip_whitelist` - Array of allowed IPs
- `expires_at` - Expiration date

---

## Multi-Account Support

Add multiple Google accounts to increase throughput. The proxy automatically switches accounts when one hits rate limits.

**Load balancing strategies:**
```bash
# Docker
docker compose up -d  # Uses hybrid by default

# Manual - set ACCOUNT_STRATEGY environment variable
ACCOUNT_STRATEGY=round-robin npm start  # Rotate each request
ACCOUNT_STRATEGY=sticky npm start       # Stay on one account
ACCOUNT_STRATEGY=hybrid npm start       # Smart selection (default)
```

---

## Web Dashboard

Access at `http://localhost:8080`:

| Tab | Description |
|-----|-------------|
| **Dashboard** | Real-time stats and quota usage |
| **Accounts** | Add/remove Google accounts |
| **API Keys** | Create and manage API keys |
| **Request Logs** | View requests with full content |
| **Settings** | Server configuration |

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `WEBUI_PASSWORD` | Password protect dashboard | (none) |
| `DEBUG` | Enable debug logging | `false` |
| `ACCOUNT_STRATEGY` | Load balancing strategy | `hybrid` |

### Docker Compose

```yaml
services:
  antigravity-proxy:
    environment:
      - PORT=8080
      - WEBUI_PASSWORD=your-secret
      - DEBUG=true
      - ACCOUNT_STRATEGY=hybrid
```

---

## Troubleshooting

**Can't connect:**
```bash
curl http://localhost:8080/health
```

**401 Unauthorized:**
- API key is invalid or missing
- Re-add your Google account via Web UI

**429 Rate Limited:**
- Add more Google accounts for higher limits
- Check quotas: `curl http://localhost:8080/account-limits`

**Model not found:**
- Check available models: `curl http://localhost:8080/v1/models -H "Authorization: Bearer sk-ag-..."`
- Verify your API key allows the requested model

---

## Risk Notice

- **Not affiliated with Google or Anthropic**
- May violate Terms of Service - use at your own risk
- For personal/development use only
- Your account could be suspended

---

## License

MIT

---

## Credits

Forked from [badrisnarayanan/antigravity-claude-proxy](https://github.com/badrisnarayanan/antigravity-claude-proxy).

Based on [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) and [claude-code-proxy](https://github.com/1rgs/claude-code-proxy).
