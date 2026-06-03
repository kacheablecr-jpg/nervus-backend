FROM node:22-alpine AS builder
WORKDIR /app

# Herramientas necesarias para compilar módulos nativos (bcrypt)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --unsafe-perm

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser

EXPOSE 10000
CMD ["node", "dist/main"]
