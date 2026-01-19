# Antigravity Claude Proxy

A proxy server that lets you use **Claude** and **Gemini** models with any OpenAI/Anthropic-compatible client through Google's Antigravity Cloud Code API.

```
Your App  ───▶  This Proxy (localhost:8080)  ───▶  Google Cloud Code API
```

## Installation

### Option 1: npm (Recommended)

```bash
npx antigravity-claude-proxy@latest start
```

### Option 2: Clone Repository

```bash
git clone https://github.com/badri-s2001/antigravity-claude-proxy.git
cd antigravity-claude-proxy
npm install
npm start
```

Server runs on `http://localhost:8080` by default.

---

## Setup

### 1. Add a Google Account

**Via Web Dashboard:**
1. Open `http://localhost:8080`
2. Click **Accounts** → **Add Account**
3. Complete Google OAuth in the popup

**Via CLI:**
```bash
# Desktop (opens browser)
npx antigravity-claude-proxy accounts add

# Headless/SSH (manual code entry)
npx antigravity-claude-proxy accounts add --no-browser
```

### 2. Verify Setup

```bash
curl http://localhost:8080/health
curl "http://localhost:8080/account-limits?format=table"
```

---

## Usage

### With Claude Code CLI

Edit `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_AUTH_TOKEN": "any-value",
    "ANTHROPIC_MODEL": "gemini-3-flash"
  }
}
```

Then run:
```bash
claude
```

### With API Keys

Create an API key via the Web UI (`http://localhost:8080` → **API Keys** → **Create Key**), then use it:

**curl (OpenAI format):**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
```

**curl (Anthropic format):**
```bash
curl http://localhost:8080/v1/messages \
  -H "x-api-key: sk-ag-your-key-here" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "gemini-3-flash", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello!"}]}'
```

**Python (OpenAI SDK):**
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

**Python (Anthropic SDK):**
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

---

## Available Models

### Claude Models
| Model | Description |
|-------|-------------|
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-sonnet-4-5-thinking` | Claude Sonnet 4.5 with extended thinking |
| `claude-opus-4-5-thinking` | Claude Opus 4.5 with extended thinking |

### Gemini Models
| Model | Description |
|-------|-------------|
| `gemini-3-flash` | Gemini 3 Flash (fast) |
| `gemini-3-pro-low` | Gemini 3 Pro Low |
| `gemini-3-pro-high` | Gemini 3 Pro High |
| `gemini-2.5-flash` | Gemini 2.5 Flash |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite (cheapest) |
| `gemini-2.5-pro` | Gemini 2.5 Pro |

### OpenAI Model Mapping
| OpenAI Name | Maps To |
|-------------|---------|
| `gpt-4` | `claude-opus-4-5-thinking` |
| `gpt-4o` | `gemini-3-pro-high` |
| `gpt-3.5-turbo` | `gemini-3-flash` |

---

## API Key Features

Create keys with restrictions via Web UI or API:

```bash
curl -X POST http://localhost:8080/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Key",
    "allowed_models": ["gemini-*"],
    "rate_limit_rpm": 60,
    "ip_whitelist": ["192.168.1.*"],
    "expires_at": 1735689600
  }'
```

**Features:**
- **Model Restrictions**: Glob patterns (`claude-*`, `gemini-3-*`)
- **Rate Limits**: Per-minute and per-hour limits
- **IP Whitelisting**: Restrict by IP patterns
- **Expiration**: Auto-expire keys
- **Request Logging**: Full prompt/response logging per key

---

## Multi-Account Support

Add multiple Google accounts for higher throughput. The proxy auto-switches when one is rate-limited.

**Strategies:**
```bash
npx antigravity-claude-proxy start --strategy=round-robin  # Rotate every request
npx antigravity-claude-proxy start --strategy=sticky       # Stay on one account (better caching)
npx antigravity-claude-proxy start --strategy=hybrid       # Smart selection (default)
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/messages` | POST | Anthropic-compatible messages |
| `/v1/models` | GET | List models |
| `/account-limits` | GET | Account status and quotas |
| `/api/keys` | GET/POST | API key management |
| `/api/logs/requests` | GET | Request logs |

---

## Web Dashboard

Access at `http://localhost:8080`:

- **Dashboard**: Real-time stats, quota tracking
- **Accounts**: Add/remove Google accounts
- **API Keys**: Create and manage API keys with restrictions
- **Request Logs**: View full request/response history
- **Settings**: Configure server and Claude CLI

---

## CLI Commands

```bash
# Start server
npx antigravity-claude-proxy start
npx antigravity-claude-proxy start --strategy=sticky
npx antigravity-claude-proxy start --debug

# Account management
npx antigravity-claude-proxy accounts           # Interactive menu
npx antigravity-claude-proxy accounts add       # Add account
npx antigravity-claude-proxy accounts list      # List accounts
npx antigravity-claude-proxy accounts verify    # Verify tokens
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

**401 Authentication Error:**
```bash
curl -X POST http://localhost:8080/refresh-token
```

**Rate Limited (429):**
- Add more accounts, or wait for reset
- Check quotas: `curl "http://localhost:8080/account-limits?format=table"`

**Account Invalid:**
- Re-authenticate via Web UI or CLI

---

## Risk Notice

- This project is **not affiliated with Google or Anthropic**
- May violate Terms of Service - use at your own risk
- Intended for personal/development use only
- Accounts may be suspended - you assume all risk

---

## License

MIT

---

## Credits

Based on [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) and [claude-code-proxy](https://github.com/1rgs/claude-code-proxy).
