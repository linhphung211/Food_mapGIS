package com.foodmap.storefront.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.foodmap.review.dto.ReviewResponse;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * Tương đương FoodPlaceDetailSerializer trong Django DRF.
 * Trường geom trả về dạng GeoJSON Point object.
 */
@Data
@Builder
public class FoodPlaceDetailResponse {

    private Long id;
    private String name;
    private String address;
    private Long category;

    @JsonProperty("category_name")
    private String categoryName;

    @JsonProperty("phone_number")
    private String phoneNumber;

    @JsonProperty("opening_time")
    private LocalTime openingTime;

    @JsonProperty("closing_time")
    private LocalTime closingTime;

    @JsonProperty("min_price")
    private BigDecimal minPrice;

    @JsonProperty("max_price")
    private BigDecimal maxPrice;

    private String description;

    @JsonProperty("avg_rating")
    private Double avgRating;

    @JsonProperty("total_reviews")
    private Integer totalReviews;

    /** Danh sách ảnh của quán */
    private List<FoodPlaceImageResponse> images;

    /** GeoJSON Point: {"type": "Point", "coordinates": [lng, lat]} */
    private Map<String, Object> geom;

    /** Danh sách bình luận (chỉ trả về khi retrieve, không phải list) */
    private List<ReviewResponse> reviews;

    /** Chỉ trả về true nếu người xem là chủ quán */
    @JsonProperty("is_owner")
    private Boolean isOwner;
}
