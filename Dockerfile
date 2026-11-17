
FROM eclipse-temurin:21-jdk

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:${PATH}"

# Java source files
COPY App.java ./
COPY home/ ./home/

# Website files
COPY delivery/ ./delivery/
COPY frontend/ ./frontend/
COPY warehouse/ ./warehouse/
COPY videos/ ./videos/

# Components
COPY components/css ./components/css/
COPY components/js ./components/js/
COPY components/html ./components/html/

# Java libraries: BCrypt and PostgreSQL
COPY components/lib/ ./lib/

ENV HOST=0.0.0.0

EXPOSE 5000

# Compile both Java source files
RUN javac -cp "lib/*" -d . App.java home/AccountManager.java

# Start the application
CMD ["java", "-cp", ".:lib/*", "App"]
