FROM node:22-alpine AS dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY --from=dependencies /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY database/ /app/database/
RUN npm run db:generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/database /app/database
EXPOSE 3000
CMD ["sh", "-c", "npm run db:deploy && npm run start"]
