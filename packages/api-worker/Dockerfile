# CI test harness: `docker compose exec bun ...` runs migrations, seed, and the Bun tests against
# the Postgres container. `sleep infinity` keeps it alive for exec.
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

CMD ["sleep", "infinity"]
