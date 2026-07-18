package com.foodmap.review.entity;

import com.foodmap.storefront.entity.FoodPlace;
import com.foodmap.user.entity.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Map sang bảng `review` (giữ nguyên schema Django).
 * unique_together = ('user', 'food_place')
 */
@Entity
@Table(name = "review",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "food_place_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "food_place_id", nullable = false)
    private FoodPlace foodPlace;

    @Min(1) @Max(5)
    @Column(nullable = false)
    @Builder.Default
    private Integer rating = 5;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Phản hồi của chủ quán (OneToOne) */
    @OneToOne(mappedBy = "review", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private ReviewReply reply;
}
