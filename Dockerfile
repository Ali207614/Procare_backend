# syntax=docker/dockerfile:1

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} as base

WORKDIR /usr/src/app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    dumb-init

COPY package*.json ./

FROM base as deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM base as build
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM base as final

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024"

RUN mkdir -p logs && chown -R node:node logs

USER node

COPY package.json .
COPY knexfile.js .
COPY migrations ./migrations
COPY seeds ./seeds
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5001/api/v1', (res) => { process.exit(res.statusCode === 404 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
