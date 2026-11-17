
# Stage 1: Build the React frontend
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:5001
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# Stage 2: Nginx production runtime
FROM nginx:alpine

# Update Alpine packages and explicitly upgrade vulnerable libraries
RUN apk update \
    && apk upgrade --no-cache \
    && apk add --no-cache --upgrade libxslt zlib \
    && rm -rf /var/cache/apk/*

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
