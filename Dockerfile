FROM node:23-alpine

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable pnpm && pnpm install

COPY prisma ./prisma

RUN npx prisma generate || true

COPY . .

# CMD [ "pnpm", "start:dev" ]
