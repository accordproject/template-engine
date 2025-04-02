# Base image (Using lightweight Alpine variant for optimization)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for efficient caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the entire project (excluding files in .dockerignore)
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose the port the app runs on (optional, for documentation purposes)
EXPOSE 3000

# Default command (Modify if there's a specific entry point)
CMD ["node", "dist/index.js"]
