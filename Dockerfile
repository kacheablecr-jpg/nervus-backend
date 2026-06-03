FROM node:22

WORKDIR /app

RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "dist/main"]
