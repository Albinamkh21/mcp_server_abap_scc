# ==================================
# Stage 1: Builder
# ==================================
FROM node:18 AS builder 
WORKDIR /app

# Install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and compile to JS
COPY . .
RUN npm run build

# ==================================
# Stage 2: Production
# ==================================
FROM node:18-alpine

WORKDIR /app

# Install only prod dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --only=production

# Copy compiled code
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/temp

# Environments
EXPOSE 3000

# Run server
CMD ["node", "dist/server.js"]