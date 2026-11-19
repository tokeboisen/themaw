# syntax=docker/dockerfile:1
# Ét Dockerfile med et stage pr. service. Byggekonteksten er repoets rod (se docker-compose.yml).
# Filerne i OneDrive-mappen har mode 600, så kildekoden gøres læsbar, før den kører som brugeren node.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/rules/package.json packages/rules/
COPY packages/contracts/package.json packages/contracts/
COPY packages/platform/package.json packages/platform/
COPY apps/api/package.json apps/api/
COPY apps/tithe-server/package.json apps/tithe-server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS source
COPY tsconfig.json ./
COPY packages packages
COPY apps apps
RUN chmod -R a+rX /app

FROM source AS api
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/main.ts"]

FROM source AS tithe-server
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "apps/tithe-server/src/main.ts"]

FROM source AS web-build
RUN npm run build -w @maw/web

FROM caddy:2 AS web
COPY --chmod=644 deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv
