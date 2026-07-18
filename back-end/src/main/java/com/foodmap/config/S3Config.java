package com.foodmap.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

/**
 * Cấu hình AWS SDK v2 trỏ tới Supabase S3-compatible storage.
 * Tương đương cấu hình django-storages + boto3 trong Django settings.py.
 */
@Configuration
public class S3Config {

    @Value("${supabase.s3.access-key}")
    private String accessKey;

    @Value("${supabase.s3.secret-key}")
    private String secretKey;

    @Value("${supabase.s3.endpoint}")
    private String endpoint;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .endpointOverride(URI.create(endpoint))
                // Supabase S3 dùng path-style (không phải subdomain)
                .forcePathStyle(true)
                .region(Region.of("ap-southeast-1"))  // Không quan trọng với Supabase
                .build();
    }
}
