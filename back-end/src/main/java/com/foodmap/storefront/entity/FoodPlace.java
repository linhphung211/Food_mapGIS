package com.foodmap.storefront.entity;

import com.foodmap.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Map sang bảng `thongtinquanan` (giữ nguyên tên bảng Django).
 * Trường geom dùng Hibernate Spatial để lưu Point (PostGIS SRID=4326).
 */
@Entity
@Table(name = "thongtinquanan")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodPlace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Tọa độ địa lý (GIS Point).
     * Tương đương PointField(srid=4326) của Django/GeoDjango.
     * columnDefinition = "geometry(Point,4326)"
     */
    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point geom;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(name = "phone_number", length = 15)
    private String phoneNumber;

    @Column(name = "opening_time")
    private LocalTime openingTime;

    @Column(name = "closing_time")
    private LocalTime closingTime;

    @Column(name = "min_price", precision = 10, scale = 0)
    private BigDecimal minPrice;

    @Column(name = "max_price", precision = 10, scale = 0)
    private BigDecimal maxPrice;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** FK → Category (SET NULL on delete) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    /** FK → User (chủ quán) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "avg_rating")
    @Builder.Default
    private Double avgRating = 0.0;

    @Column(name = "total_reviews")
    @Builder.Default
    private Integer totalReviews = 0;

    @OneToMany(mappedBy = "foodPlace", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<FoodPlaceImage> images = new ArrayList<>();
}
