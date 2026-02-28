# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build static site
RUN npm run build

# Runtime stage - serve static files with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/build /usr/share/nginx/html/khun-phaen-tracker

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
