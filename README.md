# Antigravity API Proxy

Turn your Google Antigravity account into a fully functional API. Use Claude and Gemini models with any application that supports OpenAI or Anthropic APIs.

```
Your App  ───▶  Antigravity API Proxy  ───▶  Google Antigravity (Cloud Code)
                 (localhost:8080)
```

**What it does:**
- Connects to Google Antigravity using your Google account
- Exposes OpenAI and Anthropic compatible API endpoints
- Generates API keys you can use in any app (Cursor, Continue, LangChain, etc.)
- Manages multiple accounts for higher throughput
- Logs all requests with full prompts and responses

---

## Installation

### Option 1: npm (Recommended)

```bash
npx @jabezpauls/antigravity-api-proxy@latest start
```

### Option 2: Clone Repository

```bash
git clone https://github.com/jabezpauls/antigravity-api-proxy.git
cd antigravity-api-proxy
npm install
npm start
```

### Option 3: Docker

```bash
git clone https://github.com/jabezpauls/antigravity-api-proxy.git
cd antigravity-api-proxy
docker compose up -d
```

**Docker commands:**
```bash
# Start the proxy
docker compose up -d

# View logs
docker logs -f antigravity-proxy

# Stop the proxy
docker compose down

# Restart
docker compose restart
```

**Environment variables** (set in `docker-compose.yml`):
```yaml
environment:
  - PORT=8080
  - WEBUI_PASSWORD=your-secret-password  # Optional: protect Web UI
  - DEBUG=true                            # Optional: enable debug logging
  - ACCOUNT_STRATEGY=hybrid               # Optional: sticky, round-robin, hybrid
```

**Data persistence:** Account data is stored in a Docker volume (`antigravity-data`). To backup:
```bash
docker cp antigravity-proxy:/home/appuser/.config/antigravity-proxy/accounts.json ./backup/
```

Server runs on `http://localhost:8080`.

---

## Quick Start

### 1. Start the Proxy

```bash
npx @jabezpauls/antigravity-api-proxy start
```

### 2. Add Your Google Account

Open `http://localhost:8080` in your browser, go to **Accounts**, and click **Add Account**. Complete the Google OAuth flow.

Or via CLI:
```bash
npx @jabezpauls/antigravity-api-proxy accounts add
```

### 3. Create an API Key

Go to **API Keys** → **Create Key**. Copy the generated key (starts with `sk-ag-`).

### 4. Use the API

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
```

---

## Usage Examples

### OpenAI SDK (Python)

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

### Anthropic SDK (Python)

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

### Claude Code CLI

Edit `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_AUTH_TOKEN": "sk-ag-your-key-here",
    "ANTHROPIC_MODEL": "gemini-3-flash"
  }
}
```

### Cursor / Continue / Other Apps

Set these in your app's settings:
- **API Base URL**: `http://localhost:8080/v1`
- **API Key**: `sk-ag-your-key-here`
- **Model**: `gpt-4` or any model from the list below

---

## Available Models

### Gemini Models
| Model | Description |
|-------|-------------|
| `gemini-3-flash` | Fast, good for most tasks |
| `gemini-3-pro-low` | Pro quality, lower quota usage |
| `gemini-3-pro-high` | Pro quality, higher limits |
| `gemini-2.5-flash` | Gemini 2.5 Flash |
| `gemini-2.5-flash-lite` | Cheapest option |
| `gemini-2.5-pro` | Gemini 2.5 Pro |

### Claude Models
| Model | Description |
|-------|-------------|
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-sonnet-4-5-thinking` | With extended thinking |
| `claude-opus-4-5-thinking` | Claude Opus with thinking |

### OpenAI Model Names (Auto-mapped)
| Use This | Gets You |
|----------|----------|
| `gpt-4` | `claude-opus-4-5-thinking` |
| `gpt-4o` | `gemini-3-pro-high` |
| `gpt-3.5-turbo` | `gemini-3-flash` |

---

## API Key Features

Create keys with restrictions:

- **Model Restrictions**: Allow only specific models (`gemini-*`, `claude-*`)
- **Rate Limits**: Set requests per minute/hour
- **IP Whitelisting**: Restrict to specific IPs
- **Expiration**: Auto-expire keys on a date
- **Request Logging**: Full prompt/response history per key

Create via Web UI or API:
```bash
curl -X POST http://localhost:8080/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App Key",
    "allowed_models": ["gemini-*"],
    "rate_limit_rpm": 60
  }'
```

---

## Multi-Account Support

Add multiple Google accounts to increase your API throughput. The proxy automatically switches accounts when one hits rate limits.

```bash
# Add more accounts
npx @jabezpauls/antigravity-api-proxy accounts add

# Choose load balancing strategy
npx @jabezpauls/antigravity-api-proxy start --strategy=round-robin  # Rotate each request
npx @jabezpauls/antigravity-api-proxy start --strategy=sticky       # Stay on one account
npx @jabezpauls/antigravity-api-proxy start --strategy=hybrid       # Smart selection (default)
```

---

## Web Dashboard

Access at `http://localhost:8080`:

| Tab | What It Does |
|-----|--------------|
| **Dashboard** | Real-time stats, quota usage |
| **Accounts** | Add/remove Google accounts |
| **API Keys** | Create and manage API keys |
| **Request Logs** | View all requests with full content |
| **Settings** | Server configuration |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/messages` | POST | Anthropic-compatible messages |
| `/v1/models` | GET | List available models |
| `/api/keys` | GET/POST | Manage API keys |
| `/api/logs/requests` | GET | View request logs |
| `/health` | GET | Health check |
| `/account-limits` | GET | Account quotas |

> **Full API documentation:** See [API.md](./API.md) for detailed endpoint reference, request/response formats, code examples, and best practices.

---

## CLI Reference

```bash
# Start server
npx @jabezpauls/antigravity-api-proxy start
npx @jabezpauls/antigravity-api-proxy start --strategy=sticky
npx @jabezpauls/antigravity-api-proxy start --debug

# Manage accounts
npx @jabezpauls/antigravity-api-proxy accounts           # Interactive menu
npx @jabezpauls/antigravity-api-proxy accounts add       # Add account
npx @jabezpauls/antigravity-api-proxy accounts add --no-browser  # Headless mode
npx @jabezpauls/antigravity-api-proxy accounts list      # List accounts
npx @jabezpauls/antigravity-api-proxy accounts verify    # Check token validity
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 8080) |
| `WEBUI_PASSWORD` | Password protect the dashboard |
| `DEBUG` | Enable debug logging |

---

## Troubleshooting

**Can't connect:**
- Make sure the proxy is running: `npx @jabezpauls/antigravity-api-proxy start`
- Check health: `curl http://localhost:8080/health`

**401 Unauthorized:**
- Your Google token may have expired
- Re-add your account or refresh: `curl -X POST http://localhost:8080/refresh-token`

**429 Rate Limited:**
- Add more Google accounts for higher limits
- Check quotas: `curl "http://localhost:8080/account-limits?format=table"`

**Model not allowed:**
- Check your API key's allowed models in the Web UI

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
