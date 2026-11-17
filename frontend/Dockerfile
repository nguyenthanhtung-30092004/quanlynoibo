FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=build /app/package*.json ./
RUN npm ci --omit=dev && chown -R node:node /app
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/next.config.mjs ./
# Ảnh tĩnh (logo, robots.txt) phục vụ ở đường dẫn gốc, vd /xvip-logo.png
COPY --chown=node:node --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["npm", "start"]
