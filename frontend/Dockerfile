FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Expose Vite dev port
EXPOSE 5173

# Run in dev mode with host binding
CMD ["npm", "run", "dev", "--", "--host"]
