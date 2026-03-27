# Use Playwright's official image — includes system deps (fonts, libs)
FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

WORKDIR /app

# Copy everything (hatchling needs the pricepilot/ dir to resolve the package)
COPY pyproject.toml .
COPY pricepilot/ pricepilot/

# Install Python deps, stealth plugin, then install matching Chromium browser
RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir playwright-stealth && \
    python -m playwright install chromium

# Cloud Run injects PORT env var
ENV PRICEPILOT_HOST=0.0.0.0

EXPOSE 8080

CMD ["python", "-m", "pricepilot.api.server"]
