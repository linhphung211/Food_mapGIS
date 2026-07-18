package com.foodmap.review.controller;

import com.foodmap.review.dto.*;
import com.foodmap.review.service.ReviewService;
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

import java.util.List;
import java.util.Map;

/**
 * Tương đương ReviewViewSet + ReviewReplyViewSet trong Django.
 * Giữ nguyên URL pattern:
 *   /api/reviews/
 *   /api/reviews/{id}/
 *   /api/reviews/{id}/reply/   (POST/PATCH/DELETE)
 */
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "Đánh giá quán ăn")
public class ReviewController {

    private final ReviewService reviewService;

    // GET /api/reviews/
    @GetMapping("/")
    @Operation(summary = "Lấy danh sách đánh giá", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<List<ReviewResponse>> list(
            @Parameter(description = "Lọc đánh giá theo ID của quán ăn")
            @RequestParam(name = "food_place_id", required = false) Long foodPlaceId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(reviewService.list(userDetails.getUsername(), foodPlaceId));
    }

    // POST /api/reviews/
    @PostMapping("/")
    @Operation(summary = "Viết đánh giá cho quán ăn", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<ReviewResponse> create(
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        ReviewResponse created = reviewService.create(request, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // PUT /api/reviews/{id}/
    @PutMapping("/{id}/")
    @Operation(summary = "Cập nhật đánh giá", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<ReviewResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(reviewService.update(id, request, userDetails.getUsername()));
    }

    // PATCH /api/reviews/{id}/
    @PatchMapping("/{id}/")
    @Operation(summary = "Cập nhật 1 phần đánh giá", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<ReviewResponse> partialUpdate(
            @PathVariable Long id,
            @RequestBody ReviewRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(reviewService.update(id, request, userDetails.getUsername()));
    }

    // DELETE /api/reviews/{id}/
    @DeleteMapping("/{id}/")
    @Operation(summary = "Xoá đánh giá", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        reviewService.delete(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    // ===================================================================
    // REPLY routes: /api/reviews/{id}/reply/
    // ===================================================================

    // POST /api/reviews/{id}/reply/
    @PostMapping("/{id}/reply/")
    @Operation(summary = "Tạo phản hồi của merchant", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<ReviewReplyResponse> createReply(
            @PathVariable Long id,
            @Valid @RequestBody ReviewReplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            ReviewReplyResponse reply = reviewService.createReply(id, request, userDetails.getUsername());
            return ResponseEntity.status(HttpStatus.CREATED).body(reply);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // PATCH /api/reviews/{id}/reply/
    @PatchMapping("/{id}/reply/")
    @Operation(summary = "Sửa phản hồi của merchant", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<ReviewReplyResponse> updateReply(
            @PathVariable Long id,
            @Valid @RequestBody ReviewReplyRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(reviewService.updateReply(id, request, userDetails.getUsername()));
    }

    // DELETE /api/reviews/{id}/reply/
    @DeleteMapping("/{id}/reply/")
    @Operation(summary = "Xóa phản hồi của merchant", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<Void> deleteReply(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        reviewService.deleteReply(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}
