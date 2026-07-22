FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Build TypeScript
RUN npm run build

# Runtime user
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

ENV NODE_ENV=production PORT=3000

CMD ["node", "dist/index.js"]
