FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install ALL deps (including dev) so tsc is available for build
RUN npm ci

COPY . .

# Build TypeScript
RUN npm run build

# Prune dev deps now that build is done — keeps final image lean
RUN npm prune --omit=dev

# Runtime user
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

ENV NODE_ENV=production PORT=3000

CMD ["node", "dist/index.js"]
