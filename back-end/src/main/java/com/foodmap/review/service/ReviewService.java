package com.foodmap.review.service;

import com.foodmap.review.dto.*;
import com.foodmap.review.entity.Review;
import com.foodmap.review.entity.ReviewReply;
import com.foodmap.review.repository.ReviewRepository;
import com.foodmap.review.repository.ReviewReplyRepository;
import com.foodmap.storefront.entity.FoodPlace;
import com.foodmap.storefront.repository.FoodPlaceRepository;
import com.foodmap.user.entity.User;
import com.foodmap.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewReplyRepository replyRepository;
    private final FoodPlaceRepository foodPlaceRepository;
    private final UserRepository userRepository;

    // ===================================================================
    // LIST — Lấy danh sách review (phân quyền theo role)
    // ===================================================================
    @Transactional(readOnly = true)
    public List<ReviewResponse> list(String username, Long foodPlaceId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        List<Review> reviews;

        if (user.getRole() == User.Role.merchant) {
            // Merchant xem toàn bộ review trong quán của mình
            reviews = reviewRepository.findAllByFoodPlaceOwnerIdWithDetails(user.getId());
        } else if (foodPlaceId != null) {
            // User xem review của 1 quán cụ thể
            reviews = reviewRepository.findAllByFoodPlaceIdWithDetails(foodPlaceId);
        } else {
            // User xem lịch sử review của chính mình
            reviews = reviewRepository.findAllByUserIdWithDetails(user.getId());
        }

        return reviews.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ===================================================================
    // CREATE — Tạo review (User)
    // ===================================================================
    @Transactional
    public ReviewResponse create(ReviewRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        FoodPlace foodPlace = foodPlaceRepository.findById(request.getFoodPlaceId())
                .orElseThrow(() -> new EntityNotFoundException("Quán ăn không tồn tại"));

        // Nếu user đã review quán này, ghi đè (tương đương logic create trong Django)
        Optional<Review> existing = reviewRepository
                .findByUserIdAndFoodPlaceId(user.getId(), foodPlace.getId());

        Review review;
        if (existing.isPresent()) {
            review = existing.get();
            review.setRating(request.getRating());
            review.setComment(request.getComment());
        } else {
            review = Review.builder()
                    .user(user)
                    .foodPlace(foodPlace)
                    .rating(request.getRating())
                    .comment(request.getComment())
                    .build();
        }

        reviewRepository.save(review);
        recalculateRating(foodPlace);
        return toResponse(review);
    }

    // ===================================================================
    // UPDATE
    // ===================================================================
    @Transactional
    public ReviewResponse update(Long reviewId, ReviewRequest request, String username) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new EntityNotFoundException("Bình luận không tồn tại"));

        if (!review.getUser().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền sửa bình luận này.");
        }

        if (request.getRating() != null) review.setRating(request.getRating());
        if (request.getComment() != null) review.setComment(request.getComment());

        reviewRepository.save(review);
        recalculateRating(review.getFoodPlace());
        return toResponse(review);
    }

    // ===================================================================
    // DELETE
    // ===================================================================
    @Transactional
    public void delete(Long reviewId, String username) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new EntityNotFoundException("Bình luận không tồn tại"));

        if (!review.getUser().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền xóa bình luận này.");
        }

        FoodPlace foodPlace = review.getFoodPlace();
        reviewRepository.delete(review);
        recalculateRating(foodPlace);
    }

    // ===================================================================
    // REPLY — Merchant tạo/sửa/xóa phản hồi
    // ===================================================================
    @Transactional
    public ReviewReplyResponse createReply(Long reviewId, ReviewReplyRequest request, String username) {
        Review review = findReviewForMerchant(reviewId, username);

        if (replyRepository.existsByReviewId(reviewId)) {
            throw new IllegalStateException(
                    "Bình luận này đã được trả lời. Hãy dùng chức năng sửa để cập nhật.");
        }

        User merchant = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        ReviewReply reply = ReviewReply.builder()
                .review(review)
                .merchant(merchant)
                .content(request.getContent())
                .build();

        replyRepository.save(reply);
        return toReplyResponse(reply);
    }

    @Transactional
    public ReviewReplyResponse updateReply(Long reviewId, ReviewReplyRequest request, String username) {
        findReviewForMerchant(reviewId, username); // validate quyền

        ReviewReply reply = replyRepository.findByReviewId(reviewId)
                .orElseThrow(() -> new EntityNotFoundException("Chưa có phản hồi nào cho bình luận này."));

        if (!reply.getMerchant().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền sửa phản hồi này.");
        }

        reply.setContent(request.getContent());
        replyRepository.save(reply);
        return toReplyResponse(reply);
    }

    @Transactional
    public void deleteReply(Long reviewId, String username) {
        findReviewForMerchant(reviewId, username); // validate quyền

        ReviewReply reply = replyRepository.findByReviewId(reviewId)
                .orElseThrow(() -> new EntityNotFoundException("Chưa có phản hồi nào cho bình luận này."));

        if (!reply.getMerchant().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền xóa phản hồi này.");
        }

        replyRepository.delete(reply);
    }

    // ===================================================================
    // HELPERS
    // ===================================================================

    /**
     * Tính lại avg_rating và total_reviews sau mỗi thay đổi review.
     * Tương đương Django signal post_save / post_delete của review.
     */
    private void recalculateRating(FoodPlace foodPlace) {
        Object[] result = reviewRepository.getCountAndAvgByFoodPlaceId(foodPlace.getId());
        long total = (Long) result[0];
        double avg = result[1] instanceof Double d ? d : ((Number) result[1]).doubleValue();

        foodPlace.setTotalReviews((int) total);
        foodPlace.setAvgRating(Math.round(avg * 10.0) / 10.0);
        foodPlaceRepository.save(foodPlace);

        log.debug("Đã cập nhật rating quán #{}: avg={}, total={}", foodPlace.getId(), avg, total);
    }

    private Review findReviewForMerchant(Long reviewId, String username) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new EntityNotFoundException("Bình luận không tồn tại."));

        if (!review.getFoodPlace().getOwner().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền thao tác với bình luận này.");
        }

        return review;
    }

    ReviewResponse toResponse(Review r) {
        ReviewReplyResponse replyResponse = null;
        if (r.getReply() != null) {
            replyResponse = toReplyResponse(r.getReply());
        }

        return ReviewResponse.builder()
                .id(r.getId())
                .foodPlaceId(r.getFoodPlace().getId())
                .username(r.getUser().getUsername())
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .reply(replyResponse)
                .build();
    }

    private ReviewReplyResponse toReplyResponse(ReviewReply reply) {
        return ReviewReplyResponse.builder()
                .id(reply.getId())
                .merchant(reply.getMerchant().getUsername())
                .content(reply.getContent())
                .createdAt(reply.getCreatedAt())
                .updatedAt(reply.getUpdatedAt())
                .build();
    }
}
