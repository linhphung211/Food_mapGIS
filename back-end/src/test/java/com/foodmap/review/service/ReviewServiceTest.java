package com.foodmap.review.service;

import com.foodmap.review.entity.Review;
import com.foodmap.review.repository.ReviewRepository;
import com.foodmap.review.repository.ReviewReplyRepository;
import com.foodmap.storefront.entity.FoodPlace;
import com.foodmap.storefront.repository.FoodPlaceRepository;
import com.foodmap.user.entity.User;
import com.foodmap.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock private ReviewRepository reviewRepository;
    @Mock private ReviewReplyRepository replyRepository;
    @Mock private FoodPlaceRepository foodPlaceRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void recalculateRating_ShouldUpdateFoodPlaceAvgAndTotal() {
        // Given
        FoodPlace fp = new FoodPlace();
        fp.setId(1L);
        fp.setAvgRating(0.0);
        fp.setTotalReviews(0);

        when(reviewRepository.getCountAndAvgByFoodPlaceId(1L))
                .thenReturn(new Object[]{3L, 4.3});
        when(foodPlaceRepository.save(any())).thenReturn(fp);

        // When - trigger via delete (which calls recalculate internally)
        User user = new User();
        user.setUsername("testuser");
        user.setRole(User.Role.user);

        Review review = new Review();
        review.setId(1L);
        review.setUser(user);
        review.setFoodPlace(fp);

        when(reviewRepository.findById(1L)).thenReturn(Optional.of(review));

        reviewService.delete(1L, "testuser");

        // Then
        verify(reviewRepository).delete(review);
        verify(foodPlaceRepository).save(argThat(saved ->
                saved.getTotalReviews() == 3 && saved.getAvgRating() == 4.3));
    }
}
