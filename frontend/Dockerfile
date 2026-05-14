FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_MOCK=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MOCK=$VITE_MOCK

COPY package.json package-lock.json* ./
# npm ci is faster than `npm install` (no resolve step, deterministic)
# --prefer-offline reuses npm cache between builds; audit/fund add latency.
RUN npm ci --prefer-offline --no-audit --no-fund
COPY . .
RUN rm -f .env.local
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
