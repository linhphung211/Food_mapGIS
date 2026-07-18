package com.foodmap.review.repository;

import com.foodmap.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    /** Merchant xem tất cả review trong quán của mình */
    @Query("""
        SELECT r FROM Review r
        LEFT JOIN FETCH r.reply rp
        LEFT JOIN FETCH rp.merchant
        LEFT JOIN FETCH r.user
        WHERE r.foodPlace.owner.id = :ownerId
        ORDER BY r.createdAt DESC
        """)
    List<Review> findAllByFoodPlaceOwnerIdWithDetails(@Param("ownerId") Long ownerId);

    /** User xem review trong 1 quán */
    @Query("""
        SELECT r FROM Review r
        LEFT JOIN FETCH r.reply rp
        LEFT JOIN FETCH rp.merchant
        LEFT JOIN FETCH r.user
        WHERE r.foodPlace.id = :foodPlaceId
        ORDER BY r.createdAt DESC
        """)
    List<Review> findAllByFoodPlaceIdWithDetails(@Param("foodPlaceId") Long foodPlaceId);

    /** Lịch sử review của user */
    @Query("""
        SELECT r FROM Review r LEFT JOIN FETCH r.reply rp LEFT JOIN FETCH rp.merchant
        WHERE r.user.id = :userId ORDER BY r.createdAt DESC
        """)
    List<Review> findAllByUserIdWithDetails(@Param("userId") Long userId);

    /** Tìm review cụ thể của user để update/delete */
    List<Review> findAllByUserId(Long userId);

    /** Kiểm tra user đã review quán này chưa */
    Optional<Review> findByUserIdAndFoodPlaceId(Long userId, Long foodPlaceId);

    /** Đếm và tính avg rating cho 1 quán (dùng để tính lại rating) */
    @Query("""
        SELECT COUNT(r), COALESCE(AVG(r.rating), 0.0)
        FROM Review r WHERE r.foodPlace.id = :foodPlaceId
        """)
    Object[] getCountAndAvgByFoodPlaceId(@Param("foodPlaceId") Long foodPlaceId);
}
