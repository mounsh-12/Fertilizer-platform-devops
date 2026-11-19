
# Stage 1: Install production dependencies
FROM node:22-alpine AS build

WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package*.json ./

RUN npm ci --omit=dev


# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

RUN apk update && apk upgrade --no-cache

# Remove unused global package managers
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

# Copy production dependencies
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Copy backend source
COPY --chown=node:node . .

# Prepare upload directory
RUN mkdir -p uploads/invoices \
    && chown -R node:node /app

USER node

EXPOSE 5001

CMD ["node", "server.js"]
