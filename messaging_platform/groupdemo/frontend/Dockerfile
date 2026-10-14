FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV EXPO_NO_TELEMETRY=1 CI=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/app.json frontend/tsconfig.json ./
COPY frontend/src ./src
COPY frontend/public ./public
ARG EXPO_PUBLIC_API_URL
RUN test -n "$EXPO_PUBLIC_API_URL"
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npm run build

FROM nginx:1.28-alpine
COPY deploy/container-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
