FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install deps first (use package-lock for reproducible installs)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
