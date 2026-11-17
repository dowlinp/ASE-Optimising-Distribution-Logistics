# Install the pinned map library at build time; the runtime remains Java-only.
FROM node:22-alpine AS map-assets
WORKDIR /assets
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM eclipse-temurin:21-jdk

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

COPY App.java ./
COPY delivery/ ./delivery/
# Serve Leaflet locally so loading the map library does not depend on a CDN.
COPY --from=map-assets /assets/node_modules/leaflet/dist ./delivery/vendor/leaflet/
COPY frontend/ ./frontend/
COPY warehouse/ ./warehouse/
COPY videos/ ./videos/
COPY home/ ./home/
COPY css/ ./css/

ENV HOST=0.0.0.0

EXPOSE 5000

CMD ["java", "App.java"]
