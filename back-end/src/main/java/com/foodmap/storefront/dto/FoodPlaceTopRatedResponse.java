package com.foodmap.storefront.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Tương đương FoodPlaceTopRatedSerializer (chỉ các trường cần thiết).
 */
@Data
@Builder
public class FoodPlaceTopRatedResponse {
    private Long id;
    private String name;
    private String address;

    @JsonProperty("category_name")
    private String categoryName;

    @JsonProperty("avg_rating")
    private Double avgRating;

    @JsonProperty("total_reviews")
    private Integer totalReviews;

    @JsonProperty("min_price")
    private BigDecimal minPrice;

    @JsonProperty("max_price")
    private BigDecimal maxPrice;
}
