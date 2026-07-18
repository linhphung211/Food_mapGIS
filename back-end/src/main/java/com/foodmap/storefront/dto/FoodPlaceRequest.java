package com.foodmap.storefront.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * Request body khi tạo/cập nhật quán ăn.
 * geom nhận dạng GeoJSON {"type":"Point","coordinates":[lng,lat]}
 */
@Data
public class FoodPlaceRequest {

    @NotBlank(message = "Tên quán không được để trống")
    private String name;

    @NotBlank(message = "Địa chỉ không được để trống")
    private String address;

    private Long category;

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

    /**
     * GeoJSON Point object: {"type": "Point", "coordinates": [longitude, latitude]}
     */
    @NotNull(message = "Tọa độ không được để trống")
    private GeomRequest geom;

    @Data
    public static class GeomRequest {
        private String type;
        private List<Double> coordinates;  // [lng, lat]
    }
}
