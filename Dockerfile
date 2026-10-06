FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Set --build-arg INSTALL_DEV=true to include dev dependencies (needed for `npm run seed`, which uses faker).
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then npm ci; else npm ci --omit=dev; fi
COPY . .
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 8080
CMD ["node", "server.js"]
