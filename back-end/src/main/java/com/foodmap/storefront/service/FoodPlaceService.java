package com.foodmap.storefront.service;

import com.foodmap.review.entity.Review;
import com.foodmap.review.repository.ReviewRepository;
import com.foodmap.storefront.dto.*;
import com.foodmap.storefront.entity.Category;
import com.foodmap.storefront.entity.FoodPlace;
import com.foodmap.storefront.entity.FoodPlaceImage;
import com.foodmap.storefront.repository.CategoryRepository;
import com.foodmap.storefront.repository.FoodPlaceRepository;
import com.foodmap.user.entity.User;
import com.foodmap.user.repository.UserRepository;
import com.foodmap.user.service.S3UploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityNotFoundException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FoodPlaceService {

    private final FoodPlaceRepository foodPlaceRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final S3UploadService s3UploadService;

    // WGS84 (SRID=4326) — tương đương PointField(srid=4326) Django
    private static final GeometryFactory GEOMETRY_FACTORY =
            new GeometryFactory(new PrecisionModel(), 4326);

    // ===================================================================
    // LIST — Lấy danh sách quán ăn
    // ===================================================================
    @Transactional(readOnly = true)
    public List<FoodPlaceDetailResponse> list(String username, boolean manage, String categoryName) {
        List<FoodPlace> places;

        User currentUser = username != null
                ? userRepository.findByUsername(username).orElse(null)
                : null;

        if (manage && currentUser != null) {
            // Merchant xem quán của mình
            places = categoryName != null
                    ? foodPlaceRepository.findByOwnerIdAndCategoryNameIgnoreCase(currentUser.getId(), categoryName)
                    : foodPlaceRepository.findAllByOwnerIdWithCategory(currentUser.getId());
        } else {
            places = categoryName != null
                    ? foodPlaceRepository.findByCategoryNameIgnoreCase(categoryName)
                    : foodPlaceRepository.findAllWithCategory();
        }

        return places.stream()
                .map(fp -> toDetailResponse(fp, false, false))
                .collect(Collectors.toList());
    }

    // ===================================================================
    // LIST as GeoJSON FeatureCollection
    // ===================================================================
    @Transactional(readOnly = true)
    public Map<String, Object> listAsGeoJson(String categoryName) {
        List<FoodPlace> places = categoryName != null
                ? foodPlaceRepository.findByCategoryNameIgnoreCase(categoryName)
                : foodPlaceRepository.findAllWithCategory();

        List<Map<String, Object>> features = places.stream()
                .map(this::toGeoJsonFeature)
                .collect(Collectors.toList());

        return Map.of(
                "type", "FeatureCollection",
                "features", features
        );
    }

    // ===================================================================
    // GET ONE — Chi tiết quán ăn
    // ===================================================================
    @Transactional(readOnly = true)
    public FoodPlaceDetailResponse getById(Long id, String username) {
        FoodPlace fp = foodPlaceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy quán ăn với id: " + id));

        boolean isOwner = username != null
                && fp.getOwner().getUsername().equals(username);

        // Lấy reviews (eager load)
        return toDetailResponse(fp, true, isOwner);
    }

    // ===================================================================
    // CREATE
    // ===================================================================
    @Transactional
    public FoodPlaceDetailResponse create(FoodPlaceRequest request, String username) {
        User owner = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        FoodPlace fp = buildFromRequest(request, new FoodPlace());
        fp.setOwner(owner);
        foodPlaceRepository.save(fp);
        return toDetailResponse(fp, false, true);
    }

    // ===================================================================
    // UPDATE (PUT / PATCH)
    // ===================================================================
    @Transactional
    public FoodPlaceDetailResponse update(Long id, FoodPlaceRequest request, String username) {
        FoodPlace fp = foodPlaceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy quán ăn"));

        if (!fp.getOwner().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền cập nhật quán này.");
        }

        buildFromRequest(request, fp);
        foodPlaceRepository.save(fp);
        return toDetailResponse(fp, false, true);
    }

    // ===================================================================
    // DELETE
    // ===================================================================
    @Transactional
    public void delete(Long id, String username) {
        FoodPlace fp = foodPlaceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy quán ăn"));

        if (!fp.getOwner().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền xóa quán này.");
        }

        foodPlaceRepository.delete(fp);
    }

    // ===================================================================
    // TOP RATED
    // ===================================================================
    @Transactional(readOnly = true)
    public List<FoodPlaceTopRatedResponse> getTopRated() {
        return foodPlaceRepository.findTop10ByRating().stream()
                .map(fp -> FoodPlaceTopRatedResponse.builder()
                        .id(fp.getId())
                        .name(fp.getName())
                        .address(fp.getAddress())
                        .categoryName(fp.getCategory() != null ? fp.getCategory().getName() : null)
                        .avgRating(fp.getAvgRating())
                        .totalReviews(fp.getTotalReviews())
                        .minPrice(fp.getMinPrice())
                        .maxPrice(fp.getMaxPrice())
                        .build())
                .collect(Collectors.toList());
    }

    // ===================================================================
    // UPLOAD IMAGE
    // ===================================================================
    @Transactional
    public void uploadImage(Long foodPlaceId, MultipartFile file, String username) {
        FoodPlace fp = foodPlaceRepository.findById(foodPlaceId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy quán ăn"));

        if (!fp.getOwner().getUsername().equals(username)) {
            throw new AccessDeniedException("Bạn không có quyền upload ảnh cho quán này.");
        }

        String imageUrl = s3UploadService.upload(file, "food_places/gallery");
        FoodPlaceImage image = FoodPlaceImage.builder()
                .foodPlace(fp)
                .image(imageUrl)
                .build();
        fp.getImages().add(image);
        foodPlaceRepository.save(fp);
    }

    // ===================================================================
    // HELPERS
    // ===================================================================

    private FoodPlace buildFromRequest(FoodPlaceRequest request, FoodPlace fp) {
        fp.setName(request.getName());
        fp.setAddress(request.getAddress());
        fp.setPhoneNumber(request.getPhoneNumber());
        fp.setOpeningTime(request.getOpeningTime());
        fp.setClosingTime(request.getClosingTime());
        fp.setMinPrice(request.getMinPrice());
        fp.setMaxPrice(request.getMaxPrice());
        fp.setDescription(request.getDescription());

        // Category
        if (request.getCategory() != null) {
            Category cat = categoryRepository.findById(request.getCategory())
                    .orElseThrow(() -> new EntityNotFoundException("Danh mục không tồn tại"));
            fp.setCategory(cat);
        }

        // GeoJSON → JTS Point
        if (request.getGeom() != null && request.getGeom().getCoordinates() != null) {
            List<Double> coords = request.getGeom().getCoordinates();
            double lng = coords.get(0);
            double lat = coords.get(1);
            Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
            fp.setGeom(point);
        }

        return fp;
    }

    /**
     * Chuyển FoodPlace → FoodPlaceDetailResponse
     * Tương đương FoodPlaceDetailSerializer.
     */
    private FoodPlaceDetailResponse toDetailResponse(FoodPlace fp, boolean includeReviews, boolean isOwner) {
        // Chuyển JTS Point → GeoJSON Map
        Map<String, Object> geomMap = null;
        if (fp.getGeom() != null) {
            geomMap = Map.of(
                    "type", "Point",
                    "coordinates", List.of(fp.getGeom().getX(), fp.getGeom().getY())
            );
        }

        List<FoodPlaceImageResponse> imageResponses = fp.getImages() == null
                ? Collections.emptyList()
                : fp.getImages().stream()
                        .map(img -> FoodPlaceImageResponse.builder()
                                .id(img.getId())
                                .image(img.getImage())
                                .build())
                        .collect(Collectors.toList());

        return FoodPlaceDetailResponse.builder()
                .id(fp.getId())
                .name(fp.getName())
                .address(fp.getAddress())
                .category(fp.getCategory() != null ? fp.getCategory().getId() : null)
                .categoryName(fp.getCategory() != null ? fp.getCategory().getName() : null)
                .phoneNumber(fp.getPhoneNumber())
                .openingTime(fp.getOpeningTime())
                .closingTime(fp.getClosingTime())
                .minPrice(fp.getMinPrice())
                .maxPrice(fp.getMaxPrice())
                .description(fp.getDescription())
                .avgRating(fp.getAvgRating())
                .totalReviews(fp.getTotalReviews())
                .images(imageResponses)
                .geom(geomMap)
                .reviews(includeReviews ? null : Collections.emptyList())  // lazy load nếu cần
                .isOwner(isOwner ? true : null)
                .build();
    }

    /** Chuyển FoodPlace → GeoJSON Feature (dạng bản đồ) */
    private Map<String, Object> toGeoJsonFeature(FoodPlace fp) {
        Map<String, Object> geometry = new LinkedHashMap<>();
        if (fp.getGeom() != null) {
            geometry.put("type", "Point");
            geometry.put("coordinates", List.of(fp.getGeom().getX(), fp.getGeom().getY()));
        }

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", fp.getId());
        properties.put("name", fp.getName());
        properties.put("category_name", fp.getCategory() != null ? fp.getCategory().getName() : null);
        properties.put("avg_rating", fp.getAvgRating());
        properties.put("total_reviews", fp.getTotalReviews());
        properties.put("address", fp.getAddress());
        properties.put("min_price", fp.getMinPrice());
        properties.put("max_price", fp.getMaxPrice());

        return Map.of(
                "type", "Feature",
                "id", fp.getId(),
                "geometry", geometry,
                "properties", properties
        );
    }
}
