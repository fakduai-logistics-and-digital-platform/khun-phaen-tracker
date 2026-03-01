# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY scripts ./scripts

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build args for frontend environment variables
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_SERVER_URL
ARG VITE_TLDRAW_LICENSE_KEY
ARG VITE_APP_NAME="Khun Phaen Tracker"

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_TLDRAW_LICENSE_KEY=$VITE_TLDRAW_LICENSE_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME

# Build the application
RUN npm run build

# Runtime stage
FROM nginx:stable-alpine

# Set a custom directory to avoid conflicts with default nginx files
WORKDIR /usr/app

# Copy build files from builder stage
COPY --from=builder /app/build ./

# If the build didn't already create the subfolder, create it and move files there
# This ensures GitHub Pages compatibility (internal links typically use the base path)
RUN if [ ! -d "khun-phaen-tracker" ]; then \
    mkdir khun-phaen-tracker && \
    find . -maxdepth 1 ! -name "khun-phaen-tracker" ! -name "." -exec mv {} khun-phaen-tracker/ \; ; \
    fi && \
    # Ensure there is an index.html (SvelteKit with adapter-static + fallback 404.html often doesn't make index.html if prerender is off)
    if [ ! -f "khun-phaen-tracker/index.html" ] && [ -f "khun-phaen-tracker/404.html" ]; then \
    cp khun-phaen-tracker/404.html khun-phaen-tracker/index.html; \
    fi

# Configure Nginx to serve from the custom directory and proxy to backend
RUN echo 'server { \
    listen 80; \
    root /usr/app; \
    index index.html; \
    \
    # Support for the khun-phaen-tracker base path \
    location /khun-phaen-tracker/ { \
        alias /usr/app/khun-phaen-tracker/; \
        index index.html; \
        try_files $uri $uri/ /khun-phaen-tracker/index.html; \
    } \
    \
    # Proxy API requests to backend-server service (Internal Docker Network) \
    location /api/ { \
        proxy_pass http://backend-server:3001/api/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Proxy WebSocket requests to backend-server \
    location /ws { \
        proxy_pass http://backend-server:3001/ws; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "Upgrade"; \
        proxy_set_header Host $host; \
    } \
    \
    # Fallback for SPA routing \
    location / { \
        root /usr/app/khun-phaen-tracker; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
