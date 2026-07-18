package com.foodmap.review.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewRequest {

    @NotNull(message = "food_place là bắt buộc")
    @JsonProperty("food_place")
    private Long foodPlaceId;

    @Min(1) @Max(5)
    @NotNull
    private Integer rating;

    private String comment;
}
