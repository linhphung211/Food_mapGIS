# ===== STAGE 1: BUILD =====
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy Maven wrapper và POM trước để cache dependencies
COPY pom.xml .
COPY .mvn/ .mvn/
COPY mvnw .
RUN chmod +x mvnw

# Download dependencies (cached layer)
RUN ./mvnw dependency:go-offline -B

# Copy source và build
COPY src/ src/
RUN ./mvnw package -DskipTests -B

# ===== STAGE 2: RUN =====
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Tạo user non-root để chạy app (bảo mật)
RUN addgroup -S spring && adduser -S spring -G spring

# Copy JAR từ builder
COPY --from=builder /app/target/*.jar app.jar

USER spring

EXPOSE 8000

ENTRYPOINT ["java", "-jar", "app.jar"]
