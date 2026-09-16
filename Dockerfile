# ==============================================================================
# Stage 1: Build the React TypeScript frontend
# ==============================================================================
FROM node:20-slim AS frontend-builder
WORKDIR /build/app

# Install dependencies (utilizing Docker layer cache)
COPY src/app/package*.json ./
RUN npm ci

# Copy frontend source code and compile production assets
COPY src/app/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python 3.13 Application Runtime
# ==============================================================================
FROM python:3.13-slim

WORKDIR /app

# Install uv binary from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy project specification and source code
COPY pyproject.toml README.md uv.lock* ./
COPY src/ ./src/

# Install Python package and dependencies
RUN uv pip install --system --no-cache .

# Copy compiled frontend assets from Stage 1 into the app dist directory
COPY --from=frontend-builder /build/app/dist ./src/app/dist

# Cloud Run environment settings
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

EXPOSE 8080

# Start server entrypoint (listens on 0.0.0.0:$PORT)
CMD ["python", "-m", "translator.main"]
