# Build stage
FROM rust:1-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Cargo files for dependency caching
# (This is a simplified approach, for better caching use cargo-chef)
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies (ca-certificates for HTTPS/TLS)
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/sync-server /usr/local/bin/sync-server

# Set permissions
RUN chown -R appuser:appuser /app && \
    chown appuser:appuser /usr/local/bin/sync-server

# Switch to non-root user
USER appuser

# Expose port (default is 3001 in main.rs)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD bash -c "</dev/tcp/localhost/3001" || exit 1

# Run the server
CMD ["sync-server"]
