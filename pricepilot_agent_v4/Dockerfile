FROM python:3.12-slim

WORKDIR /app

# Install Python deps (no Playwright needed — browser tools run via Chrome extension)
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy source
COPY . .

# Cloud Run expects PORT env var
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "server.py"]
