# Antigravity API Proxy - Docker Image
# Multi-stage build for optimized image size

# ============================================
# Stage 1: Build dependencies and CSS
# ============================================
FROM node:22-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Copy source files (needed for prepare script to build CSS)
COPY public ./public
COPY tailwind.config.js postcss.config.js ./

# Install all dependencies (including devDependencies for CSS build)
# This runs the prepare script which builds CSS
RUN npm ci

# Copy remaining source files
COPY src ./src
COPY bin ./bin

# ============================================
# Stage 2: Production image
# ============================================
FROM node:22-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

# Create non-root user with home directory for config storage
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup -h /home/appuser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (skip prepare script since CSS is built in builder)
RUN npm ci --omit=dev --ignore-scripts

# Rebuild better-sqlite3 for Alpine (needed after --ignore-scripts)
RUN npm rebuild better-sqlite3

# Copy built application from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/public ./public

# Create config directory (will be mounted as volume)
RUN mkdir -p /home/appuser/.config/antigravity-proxy && \
    chown -R appuser:appgroup /home/appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOME=/home/appuser

# Switch to non-root user
USER appuser

# Expose the port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
