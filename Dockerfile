# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.3
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package*.json ./
# Use npm ci if lockfile exists, otherwise fallback to npm install
RUN if [ -f package-lock.json ]; then \
      echo "Using npm ci (lockfile present)"; npm ci --omit=dev; \
    else \
      echo "No package-lock.json found, using npm install (recommend committing a lockfile)"; npm install --omit=dev; \
    fi

# Copy application code
COPY . .

# Remove the .env file 
RUN rm -f .env

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD ["npm","start"]
