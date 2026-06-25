# Multi-stage Dockerfile for ChatBot Application
# Optimized for Kubernetes/OpenShift deployment

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production stage
FROM node:18-alpine

# Add metadata
LABEL maintainer="ChatBot Team"
LABEL description="JWT-based ChatBot Application for Kubernetes/OpenShift"
LABEL version="1.0.0"

# Create non-root user for security
# Note: OpenShift will override the UID with one from the namespace's range
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application files
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup server.js ./
COPY --chown=appuser:appgroup api/ ./api/
COPY --chown=appuser:appgroup static/ ./static/

# Create directory for logs (if needed)
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# Switch to non-root user
USER appuser

# Expose port 8080 (OpenShift-friendly, non-privileged)
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080


# Start the application
CMD ["node", "server.js"]
