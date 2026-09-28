FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

COPY packages/server packages/server
RUN npm run prisma:generate --workspace=packages/server \
  && npm run build --workspace=packages/server

# Use this target for a one-off `prisma migrate deploy` release job.
FROM build AS migrate
CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--schema", "packages/server/prisma/schema.prisma"]

FROM build AS production-deps
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/prisma ./packages/server/prisma

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "packages/server/dist/index.js"]
