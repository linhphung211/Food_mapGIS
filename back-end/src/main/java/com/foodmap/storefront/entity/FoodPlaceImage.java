package com.foodmap.storefront.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Map sang bảng `food_place_image`
 */
@Entity
@Table(name = "food_place_image")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodPlaceImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "food_place_id", nullable = false)
    private FoodPlace foodPlace;

    /** URL ảnh trên Supabase S3 */
    @Column(nullable = false, length = 500)
    private String image;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
