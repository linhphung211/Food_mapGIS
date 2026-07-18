package com.foodmap.storefront.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Map sang bảng `category` (giữ nguyên schema Django)
 */
@Entity
@Table(name = "category")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** URL của icon marker trên bản đồ (Supabase S3) */
    @Column(name = "icon_marker", length = 500)
    private String iconMarker;
}
