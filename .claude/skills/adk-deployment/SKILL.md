---
name: adk-deployment
description: Deployment guide for ADK agents — local dev, Cloud Run, Agent Engine (Vertex AI), GKE, and containerized deployment
---

# ADK Deployment

Use this skill when setting up local development or deploying ADK agents to production.

## Local Development

### Project Structure
```
my_agent/
    __init__.py
    agent.py       # Must export `root_agent`
    .env           # API keys
    tools/
        __init__.py
        my_tools.py
```

### Environment Variables (.env)

**Google AI Studio** (simplest, for dev):
```env
GOOGLE_API_KEY=your_api_key
GOOGLE_GENAI_USE_VERTEXAI=FALSE
```

**Vertex AI** (production):
```env
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
```

### Run Locally
```bash
# Interactive CLI
adk run my_agent

# Web UI (best for debugging — shows events, state, tool calls)
adk web --port 8000

# API Server
adk api_server
```

### Create New Project
```bash
pip install google-adk
adk create my_agent
```

---

## Deployment Options

| Option | Best For | Language | Managed |
|--------|----------|----------|---------|
| Agent Engine (Vertex AI) | Production, auto-scaling | Python only | Fully managed |
| Cloud Run | Containerized, any language | All | Semi-managed |
| GKE | Kubernetes, open models | All | Self-managed |
| Any container runtime | Docker/Podman | All | Self-managed |

---

## Cloud Run Deployment

### Quick Deploy (CLI)
```bash
adk deploy cloud_run \
    --project=$GOOGLE_CLOUD_PROJECT \
    --region=$GOOGLE_CLOUD_LOCATION \
    my_agent
```

### Manual Dockerfile
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### FastAPI Server (main.py)
```python
from google.adk.cli.fast_api import get_fast_api_app

app = get_fast_api_app(
    agents_dir="./",
    session_service_uri="sqlite+aiosqlite:///./sessions.db",
    web=True,  # Enable web UI at /dev-ui
)
```

### Cloud Build (cloudbuild.yaml)
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/my-agent', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/my-agent']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'deploy'
      - 'my-agent'
      - '--image=gcr.io/$PROJECT_ID/my-agent'
      - '--region=$_REGION'
      - '--platform=managed'
      - '--allow-unauthenticated'
    entrypoint: gcloud
```

---

## Agent Engine (Vertex AI)

Fully managed deployment — handles scaling, sessions, memory automatically.

```python
import vertexai
from vertexai import agent_engines

vertexai.init(project="your-project", location="us-central1")

# Deploy
remote_agent = agent_engines.create(
    agent_engine=your_agent,
    requirements=["google-adk>=0.6.0"],
)

# Query
response = remote_agent.query(input="Hello", user_id="user1", session_id="session1")
```

---

## API Endpoints (Deployed Server)

When using `adk api_server` or `get_fast_api_app`, these endpoints are available:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/list-apps` | GET | List available agents |
| `/apps/{app}/users/{user}/sessions/{session}` | POST | Create/update session |
| `/run_sse` | POST | Run agent (streaming) |

### Run Request Body
```json
{
    "app_name": "my_agent",
    "user_id": "user_123",
    "session_id": "session_456",
    "new_message": {
        "role": "user",
        "parts": [{"text": "Hello"}]
    },
    "streaming": true
}
```

---

## Production Checklist

### Services
- [ ] Replace `InMemorySessionService` with `DatabaseSessionService` or `VertexAiSessionService`
- [ ] Replace `InMemoryArtifactService` with `GcsArtifactService` (if using artifacts)
- [ ] Replace `InMemoryMemoryService` with `VertexAiMemoryBankService` (if using memory)

### Configuration
- [ ] Use environment variables for all secrets and config
- [ ] Set appropriate model (balance capability vs. cost vs. latency)
- [ ] Configure retry options on model:
```python
generate_content_config=types.GenerateContentConfig(
    http_options=types.HttpOptions(
        retry_options=types.HttpRetryOptions(initial_delay=1, attempts=2)
    )
)
```

### Reliability
- [ ] All tools return structured `{"status": "success/error"}` dicts
- [ ] Tools catch exceptions and return error info
- [ ] Callbacks return `None` unless intentionally overriding
- [ ] State uses correct prefixes for desired scope

### Evaluation
- [ ] Create `.test.json` eval files
- [ ] Run `adk eval my_agent eval_set.test.json` before deploy
- [ ] Monitor key metrics: `tool_trajectory_avg_score`, `response_match_score`

### Monitoring
- [ ] Enable logging at appropriate level
- [ ] Track token usage and latency
- [ ] Set up alerts for error rates
