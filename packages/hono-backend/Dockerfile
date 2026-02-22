FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY . .

# Pre-warm the uv cache so the first request doesn't pay the install cost
RUN uv run src/modules/risk/risk_model.py < /dev/null || true

EXPOSE 3000

CMD ["bun", "run", "--hot", "src/index.ts"]
