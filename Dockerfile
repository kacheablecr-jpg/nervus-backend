FROM node:22

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "dist/main"]
