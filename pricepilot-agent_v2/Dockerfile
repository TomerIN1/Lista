FROM python:3.11-slim

WORKDIR /app

# Copy everything (hatchling needs the pricepilot/ dir to resolve the package)
COPY pyproject.toml .
COPY pricepilot/ pricepilot/

# Install
RUN pip install --no-cache-dir .

# Cloud Run injects PORT env var
ENV PRICEPILOT_HOST=0.0.0.0

EXPOSE 8080

CMD ["python", "-m", "pricepilot.api.server"]
