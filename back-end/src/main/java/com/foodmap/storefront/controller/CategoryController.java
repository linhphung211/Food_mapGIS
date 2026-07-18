package com.foodmap.storefront.controller;

import com.foodmap.storefront.dto.CategoryResponse;
import com.foodmap.storefront.entity.Category;
import com.foodmap.storefront.repository.CategoryRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Tương đương CategoryViewSet trong Django.
 * Public (AllowAny) để FE dropdown luôn hiển thị được.
 */
@RestController
@RequestMapping("/api/storefronts/categories")
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Danh mục quán ăn")
public class CategoryController {

    private final CategoryRepository categoryRepository;

    // GET /api/storefronts/categories/
    @GetMapping("/")
    @Operation(summary = "Lấy danh sách danh mục")
    public ResponseEntity<List<CategoryResponse>> list() {
        List<CategoryResponse> result = categoryRepository.findAllByOrderByNameAsc()
                .stream()
                .map(c -> CategoryResponse.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .iconMarker(c.getIconMarker())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // GET /api/storefronts/categories/{id}/
    @GetMapping("/{id}/")
    @Operation(summary = "Lấy chi tiết danh mục")
    public ResponseEntity<CategoryResponse> retrieve(@PathVariable Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Danh mục không tồn tại"));
        return ResponseEntity.ok(CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .iconMarker(category.getIconMarker())
                .build());
    }
}
