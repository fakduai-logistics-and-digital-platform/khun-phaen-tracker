# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

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

# Copy custom nginx config if we had one, otherwise use default with SPA support
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copy build files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
