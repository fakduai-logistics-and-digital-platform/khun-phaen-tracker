# Build stage
FROM docker.io/library/rust:1.75-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev

# Copy Cargo files
COPY Cargo.toml ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Runtime stage
FROM docker.io/library/debian:bookworm-slim

# Install ca-certificates for HTTPS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash appuser

# Copy binary from builder
COPY --from=builder /app/target/release/sync-server /usr/local/bin/sync-server

# Set ownership
RUN chown appuser:appuser /usr/local/bin/sync-server

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD nc -z localhost 3001 || exit 1

# Run server
CMD ["sync-server"]
