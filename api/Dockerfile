FROM python:3.12-slim

WORKDIR /app

# Install git for pip install from github
RUN apt-get update && apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

# Install skyroute from pinned commit
RUN pip install --no-cache-dir "git+https://github.com/buildingopen/opensky.git@fd9c0fe"

# Install app dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .
COPY alert_worker.py .
COPY zone_alert_worker.py .

# Alerts DB volume mount point
VOLUME /data

EXPOSE 8090

RUN adduser --disabled-password --gecos '' --uid 1001 appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8090/api/healthz || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "4"]
