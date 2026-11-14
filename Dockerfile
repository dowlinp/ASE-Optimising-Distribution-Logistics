
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
COPY css/ ./css/

ENV HOST=0.0.0.0

EXPOSE 5000

CMD ["java", "App.java"]
