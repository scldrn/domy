FROM node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build

WORKDIR /workspace

RUN corepack enable \
  && corepack prepare pnpm@12.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/domain/package.json ./packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY apps/server ./apps/server
COPY apps/web ./apps/web
COPY packages/domain ./packages/domain
COPY tsconfig.base.json tsconfig.json ./

ARG PUBLIC_BASE_URL
ARG VITE_SENTRY_DSN

RUN PUBLIC_BASE_URL="$PUBLIC_BASE_URL" node --input-type=module -e 'import { publicOriginSchema } from "./packages/domain/src/schemas/public-origin.ts"; const input = process.env.PUBLIC_BASE_URL; const parsed = publicOriginSchema.safeParse(input); if (!parsed.success || parsed.data !== input || !parsed.data.startsWith("https://")) { console.error("PUBLIC_BASE_URL must be a canonical HTTPS origin"); process.exit(1); }' \
  && APP_URL="$PUBLIC_BASE_URL" PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
    SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
    VITE_SENTRY_DSN="$VITE_SENTRY_DSN" pnpm build

FROM node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS runtime

WORKDIR /workspace

RUN corepack enable \
  && corepack prepare pnpm@12.8.1 --activate

COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/apps/server/package.json ./apps/server/package.json
COPY --from=build /workspace/apps/web/package.json ./apps/web/package.json
COPY --from=build /workspace/packages/domain/package.json ./packages/domain/package.json

RUN pnpm install --filter @domy/server... --prod --frozen-lockfile

COPY --from=build --chown=node:node /workspace/apps/server/src ./apps/server/src
COPY --from=build --chown=node:node /workspace/packages/domain/src ./packages/domain/src
COPY --from=build --chown=node:node /workspace/apps/web/dist ./apps/web/dist

ARG VITE_SENTRY_DSN
ENV NODE_ENV=production \
    API_PORT=3000 \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

USER node
WORKDIR /workspace/apps/server
EXPOSE 3000
CMD ["node", "src/index.ts"]
