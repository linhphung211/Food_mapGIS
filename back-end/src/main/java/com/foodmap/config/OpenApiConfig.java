package com.foodmap.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình Swagger UI / OpenAPI
 * Tương đương drf-spectacular trong Django.
 * Swagger UI: http://localhost:8000/api/swagger/
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI foodmapOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Foodmap API")
                        .description("API cho ứng dụng Foodmap - Tìm kiếm địa điểm ăn uống")
                        .version("1.0.0"))
                .addSecurityItem(new SecurityRequirement().addList("Bearer"))
                .components(new Components()
                        .addSecuritySchemes("Bearer",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .name("Authorization")));
    }
}
