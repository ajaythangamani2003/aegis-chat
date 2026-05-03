FROM eclipse-temurin:21-jdk

WORKDIR /app

COPY . .

RUN chmod +x mvnw

RUN ./mvnw clean package -DskipTests -Dspring-boot.run.skip=true

EXPOSE 8080

CMD ["java", "-jar", "target/project-0.0.1-SNAPSHOT.jar"]