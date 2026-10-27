FROM node:22.22.3-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@12.4.1 --activate

WORKDIR /workspace

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json

RUN pnpm install --frozen-lockfile --filter api...

FROM dependencies AS build

COPY api/nest-cli.json api/tsconfig.json ./api/
COPY api/src ./api/src

RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --frozen-lockfile /prod/api

FROM node:22.22.3-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV PORT="3001"

WORKDIR /app

COPY --from=build --chown=node:node /prod/api/package.json ./package.json
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/api/dist ./dist

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT ?? '3001') + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

CMD ["node", "--enable-source-maps", "dist/main.js"]
