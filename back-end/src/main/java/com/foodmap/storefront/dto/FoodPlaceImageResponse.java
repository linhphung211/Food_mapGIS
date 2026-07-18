package com.foodmap.storefront.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FoodPlaceImageResponse {
    private Long id;
    private String image;
}
