# Multi-stage build:
# 1) Build the Next.js frontend
FROM node:20-slim AS frontend

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# 2) Python agent image (includes built frontend)
FROM python:3.11-slim AS agent

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps: git + curl are useful for gh CLI and debugging
RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deepagents-cli with OpenAI extras (as required)
RUN pip install --no-cache-dir 'deepagents-cli[openai]'

# Copy agent code and lockfiles
COPY agent/ ./agent/

# Install agent dependencies
RUN pip install --no-cache-dir -r agent/requirements.txt 2>/dev/null \
  || pip install --no-cache-dir -e ./agent

# Copy built frontend artifacts
COPY --from=frontend /app/.next ./.next
COPY --from=frontend /app/public ./public
COPY --from=frontend /app/package.json ./package.json
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/next.config.ts ./next.config.ts

# Default runtime config
ENV AGENT_MODE=research \
    PROVIDER=openai

EXPOSE 3000

CMD ["npm", "start"]
