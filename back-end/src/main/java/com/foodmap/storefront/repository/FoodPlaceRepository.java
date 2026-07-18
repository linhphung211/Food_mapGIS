package com.foodmap.storefront.repository;

import com.foodmap.storefront.entity.FoodPlace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FoodPlaceRepository extends JpaRepository<FoodPlace, Long> {

    /** Danh sách tất cả quán, eager load category (tránh N+1) */
    @Query("SELECT fp FROM FoodPlace fp LEFT JOIN FETCH fp.category")
    List<FoodPlace> findAllWithCategory();

    /** Lọc theo owner (cho Merchant manage) */
    @Query("SELECT fp FROM FoodPlace fp LEFT JOIN FETCH fp.category WHERE fp.owner.id = :ownerId")
    List<FoodPlace> findAllByOwnerIdWithCategory(@Param("ownerId") Long ownerId);

    /** Lọc theo tên danh mục (case-insensitive) */
    @Query("""
        SELECT fp FROM FoodPlace fp LEFT JOIN FETCH fp.category c
        WHERE LOWER(c.name) = LOWER(:categoryName)
        """)
    List<FoodPlace> findByCategoryNameIgnoreCase(@Param("categoryName") String categoryName);

    /** Lọc theo owner VÀ tên danh mục */
    @Query("""
        SELECT fp FROM FoodPlace fp LEFT JOIN FETCH fp.category c
        WHERE fp.owner.id = :ownerId AND LOWER(c.name) = LOWER(:categoryName)
        """)
    List<FoodPlace> findByOwnerIdAndCategoryNameIgnoreCase(
            @Param("ownerId") Long ownerId,
            @Param("categoryName") String categoryName);

    /** Top 10 quán theo rating (có ít nhất 1 review) */
    @Query("""
        SELECT fp FROM FoodPlace fp LEFT JOIN FETCH fp.category
        WHERE fp.totalReviews > 0
        ORDER BY fp.avgRating DESC, fp.totalReviews DESC
        """)
    List<FoodPlace> findTop10ByRating();
}
