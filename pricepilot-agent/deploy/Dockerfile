FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml .
COPY pricepilot/ pricepilot/

# Install Python dependencies
RUN pip install --no-cache-dir .

# Install Playwright browsers
RUN playwright install chromium

EXPOSE 8000

CMD ["uvicorn", "pricepilot.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
