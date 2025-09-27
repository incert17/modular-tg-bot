# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs && \
    chown -R botuser:nodejs /app

# Switch to non-root user
USER botuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node scripts/health-check.js || exit 1

# Default command (can be overridden)
CMD ["npm", "start"]

# Labels for metadata
LABEL maintainer="Modular Bot Framework" \
      version="1.0.0" \
      description="Modular Telegram Bot Framework" \
      org.opencontainers.image.source="https://github.com/your-username/modular-telegram-bot"

