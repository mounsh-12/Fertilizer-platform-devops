
# Build stage
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginxinc/nginx-unprivileged:alpine

USER root

RUN apk update && apk upgrade --no-cache \
    && mkdir -p /tmp/client_temp \
                 /tmp/proxy_temp \
                 /tmp/fastcgi_temp \
                 /tmp/uwsgi_temp \
                 /tmp/scgi_temp \
    && chown -R 101:101 /tmp

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R 101:101 /usr/share/nginx/html \
    && chown -R 101:101 /etc/nginx/conf.d

USER 101

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
