# Multi-stage build:
# 1) Build the Next.js frontend
# 2) Build a lightweight runtime that can also run the Python agent tooling

FROM node:20-slim AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM python:3.11-slim AS runtime

WORKDIR /app

# Install deepagents-cli (used by the coding agent image)
RUN pip install --no-cache-dir 'deepagents-cli[openai]'

# Copy built Next.js app and runtime files
COPY --from=frontend-build /app /app

EXPOSE 3000

# Default remains the Next.js server; the agent can be run in a separate service/container.
CMD ["npm", "start"]
