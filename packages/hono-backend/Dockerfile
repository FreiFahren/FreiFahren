FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY . .

# Pre-warm the uv cache so the first request doesn't pay the install cost.
# Empty-but-valid input lets the script run to completion (exit 0), so a
# failed dependency download correctly aborts the build instead of being
# swallowed by || true.
RUN echo '{"segments":[],"reports":[]}' | uv run src/modules/risk/risk_model.py

EXPOSE 3000

CMD ["bun", "run", "--hot", "src/index.ts"]
