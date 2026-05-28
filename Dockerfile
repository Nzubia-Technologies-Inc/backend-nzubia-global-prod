FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy pre-built application (dist is built in CI before this image is built)
COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
