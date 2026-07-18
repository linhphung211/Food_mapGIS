package com.foodmap.storefront.controller;

import com.foodmap.storefront.dto.*;
import com.foodmap.storefront.service.FoodPlaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Tương đương FoodPlaceViewSet trong Django.
 * Giữ nguyên tất cả URL patterns.
 */
@RestController
@RequestMapping("/api/storefronts/foodplaces")
@RequiredArgsConstructor
@Tag(name = "Food Places", description = "Quản lý quán ăn")
public class FoodPlaceController {

    private final FoodPlaceService foodPlaceService;

    // GET /api/storefronts/foodplaces/
    @GetMapping("/")
    @Operation(summary = "Lấy danh sách quán ăn")
    public ResponseEntity<?> list(
            @Parameter(description = "Truyền 'geojson' để lấy data dạng bản đồ")
            @RequestParam(required = false) String format,
            @Parameter(description = "Truyền true nếu muốn xem danh sách quán của merchant đang đăng nhập")
            @RequestParam(required = false, defaultValue = "false") boolean manage,
            @Parameter(description = "Lọc quán ăn theo tên danh mục (vd: 'Nhà Hàng')")
            @RequestParam(required = false) String category,
            @AuthenticationPrincipal UserDetails userDetails) {

        // ?format=geojson → trả về GeoJSON FeatureCollection (cho bản đồ)
        if ("geojson".equalsIgnoreCase(format)) {
            Map<String, Object> geojson = foodPlaceService.listAsGeoJson(category);
            return ResponseEntity.ok(geojson);
        }

        String username = userDetails != null ? userDetails.getUsername() : null;
        List<FoodPlaceDetailResponse> result = foodPlaceService.list(username, manage, category);
        return ResponseEntity.ok(result);
    }

    // GET /api/storefronts/foodplaces/top_rated/
    @GetMapping("/top_rated/")
    @Operation(summary = "Danh sách Top 10 quán ăn đánh giá cao")
    public ResponseEntity<List<FoodPlaceTopRatedResponse>> topRated() {
        return ResponseEntity.ok(foodPlaceService.getTopRated());
    }

    // GET /api/storefronts/foodplaces/{id}/
    @GetMapping("/{id}/")
    @Operation(summary = "Xem chi tiết quán ăn")
    public ResponseEntity<FoodPlaceDetailResponse> retrieve(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        String username = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(foodPlaceService.getById(id, username));
    }

    // POST /api/storefronts/foodplaces/
    @PostMapping("/")
    @Operation(summary = "Tạo mới quán ăn (Chỉ Merchant)", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<FoodPlaceDetailResponse> create(
            @Valid @RequestBody FoodPlaceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        FoodPlaceDetailResponse created = foodPlaceService.create(request, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // PUT /api/storefronts/foodplaces/{id}/
    @PutMapping("/{id}/")
    @Operation(summary = "Cập nhật thông tin quán ăn", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<FoodPlaceDetailResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody FoodPlaceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(foodPlaceService.update(id, request, userDetails.getUsername()));
    }

    // PATCH /api/storefronts/foodplaces/{id}/
    @PatchMapping("/{id}/")
    @Operation(summary = "Cập nhật 1 phần thông tin quán ăn", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<FoodPlaceDetailResponse> partialUpdate(
            @PathVariable Long id,
            @RequestBody FoodPlaceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(foodPlaceService.update(id, request, userDetails.getUsername()));
    }

    // DELETE /api/storefronts/foodplaces/{id}/
    @DeleteMapping("/{id}/")
    @Operation(summary = "Xoá quán ăn", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        foodPlaceService.delete(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    // POST /api/storefronts/foodplaces/{id}/upload_image/
    @PostMapping("/{id}/upload_image/")
    @Operation(summary = "Upload ảnh cho quán ăn", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<Map<String, String>> uploadImage(
            @PathVariable Long id,
            @RequestParam("image") MultipartFile image,
            @AuthenticationPrincipal UserDetails userDetails) {

        if (image == null || image.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Vui lòng cung cấp file ảnh (trường image)."));
        }

        foodPlaceService.uploadImage(id, image, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("status", "Tải ảnh lên thành công."));
    }
}
