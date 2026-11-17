
# Use Node.js 22 as the base image
FROM node:22-alpine
RUN apk upgrade --no-cache && npm install -g npm@11
# Set the container working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend application files
COPY --chown=node:node . .

# Create directory for generated invoice PDFs
RUN mkdir -p uploads/invoices \
    && chown -R node:node /app

# Run as a non-root user
USER node

# Backend listens on port 5001
EXPOSE 5001

# Start the production server
CMD ["npm", "start"]
