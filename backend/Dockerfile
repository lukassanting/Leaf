FROM python:3.11-bookworm as builder

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && POETRY_VERSION=2.3.2 curl -fsSL --connect-timeout 30 --max-time 600 https://install.python-poetry.org | python3 - \
    && /root/.local/bin/poetry --version

ENV PATH="/root/.local/bin:${PATH}" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache \
    PIP_DEFAULT_TIMEOUT=120

WORKDIR /app

# Copy poetry configuration files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (--no-dev removed in Poetry 2; dev deps live in group "dev")
RUN poetry install --no-root --only main -v

# Copy application code
COPY . .

# Install the project
RUN poetry install --only main -v

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app /app

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"

# Expose the port your FastAPI app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]