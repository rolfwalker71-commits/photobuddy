# syntax=docker/dockerfile:1
# Multi-stage Next.js standalone image. GitHub Actions builds linux/amd64 only.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SITE_URL=http://localhost:3388
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3388
ENV HOSTNAME=0.0.0.0
ENV PHOTOS_DIR=/data/photos

RUN apk add --no-cache su-exec \
  && npm install -g web-push@3.6.7 \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data/vapid /data/photos /app/public

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY db/migrations ./db/migrations
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R nextjs:nodejs /data/vapid /data/photos /app/public /app/db

EXPOSE 3388
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
