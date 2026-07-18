package com.foodmap.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

/**
 * Tương đương django-storages (S3Boto3Storage).
 * Upload file lên Supabase S3-compatible storage.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class S3UploadService {

    private final S3Client s3Client;

    @Value("${supabase.s3.bucket-name}")
    private String defaultBucket;

    @Value("${supabase.s3.project-id}")
    private String projectId;

    /**
     * Upload file lên S3 bucket và trả về public URL.
     * @param file   MultipartFile từ request
     * @param folder Thư mục trong bucket (vd: "avatars", "food_places/gallery")
     * @return URL công khai của file
     */
    public String upload(MultipartFile file, String folder) {
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
        String key = folder + "/" + UUID.randomUUID() + extension;

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(defaultBucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(request, RequestBody.fromInputStream(
                    file.getInputStream(), file.getSize()));

            // URL công khai Supabase format
            String publicUrl = String.format(
                    "https://%s.supabase.co/storage/v1/object/public/%s/%s",
                    projectId, defaultBucket, key
            );

            log.info("File uploaded: {}", publicUrl);
            return publicUrl;

        } catch (IOException e) {
            log.error("Lỗi upload file lên S3: {}", e.getMessage());
            throw new RuntimeException("Không thể upload file: " + e.getMessage(), e);
        }
    }
}
