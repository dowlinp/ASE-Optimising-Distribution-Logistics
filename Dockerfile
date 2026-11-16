
FROM eclipse-temurin:21-jdk

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

COPY App.java ./
COPY delivery/ ./delivery/
COPY frontend/ ./frontend/
COPY warehouse/ ./warehouse/
COPY videos/ ./videos/
COPY home/ ./home/
COPY components/css ./components/css/
COPY components/js ./components/js/
COPY components/html ./components/html/
COPY components/lib ./components/lib/

ENV HOST=0.0.0.0

EXPOSE 5000

CMD ["java", "--class-path", ".:lib/*", "App.java"]
