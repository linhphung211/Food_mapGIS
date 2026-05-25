/**
 * script.js – Front-end User: Bản đồ ăn uống Việt Nam
 * Tích hợp đầy đủ API backend (JWT auth, reviews CRUD, GeoJSON foodplaces)
 */
import {
    isLoggedIn, getUsername,
    getFoodPlacesGeoJSON, getFoodPlaceDetail,
    createReview, updateReview, deleteReview,
    getCategories, getTopRatedFoodPlaces,
    getMe, updateUserProfile
} from './api.js?v=7';

// ─────────────────────────────────────────────
//  KHỞI TẠO BẢN ĐỒ LEAFLET
// ─────────────────────────────────────────────
// Tọa độ giới hạn (Bounding Box) của Cầu Giấy theo API bạn cung cấp
const cauGiayBounds = [
    [21.01766586303711, 105.77861022949219], // South-West
    [21.04180145263672, 105.80133056640625]  // North-East
];

// Khởi tạo bản đồ, mặc định zoom vào khu vực Cầu Giấy nhưng không khóa cứng
const map = L.map('map', { zoomControl: false }).fitBounds(cauGiayBounds);
L.control.zoom({ position: 'bottomright' }).addTo(map);
map.attributionControl.setPosition('bottomleft');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Lớp bản đồ ranh giới Cầu Giấy (WMS từ GeoServer)
const cauGiayWMS = L.tileLayer.wms('http://localhost:8080/geoserver/dacn/wms', {
    layers: 'dacn:cau_giay',
    format: 'image/png',
    transparent: true,
    version: '1.1.0',
    attribution: 'Dữ liệu không gian quận Cầu Giấy'
}).addTo(map);

let foodMarkersLayer = L.layerGroup().addTo(map);
let heatLayer = null;
let isHeatmapActive = false;
let currentHeatmapData = [];

// ─────────────────────────────────────────────
//  TOAST NOTIFICATION
// ─────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const existing = document.getElementById('fm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'fm-toast';
    toast.className = `fm-toast fm-toast--${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('fm-toast--show'), 10);
    setTimeout(() => {
        toast.classList.remove('fm-toast--show');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ─────────────────────────────────────────────
//  RENDER STARS (chỉ đọc)
// ─────────────────────────────────────────────
function renderStars(rating) {
    return [1,2,3,4,5].map(i =>
        `<i class="fa-${i <= rating ? 'solid' : 'regular'} fa-star" style="color:${i <= rating ? '#e67e22' : '#ccc'}; font-size:12px;"></i>`
    ).join('');
}

// ─────────────────────────────────────────────
//  POPUP: xây HTML bình luận (async)
// ─────────────────────────────────────────────
async function buildPopupContent(placeId) {
    const place = await getFoodPlaceDetail(placeId);
    if (!place) return '<p style="color:red;font-size:12px;">Không tải được thông tin quán.</p>';

    const loggedIn = isLoggedIn();
    const userId   = parseInt(localStorage.getItem('user_id') || '0', 10);

    // Ảnh bìa
    const imgSrc = place.images?.[0]?.image || 'https://via.placeholder.com/260x95?text=Food+Map';

    // Giờ mở cửa
    const timeStr = (place.opening_time && place.closing_time)
        ? `${place.opening_time.slice(0,5)} – ${place.closing_time.slice(0,5)}`
        : 'Chưa cập nhật';

    // Giá
    const priceStr = (place.min_price || place.max_price)
        ? `${Number(place.min_price||0).toLocaleString('vi-VN')}đ – ${Number(place.max_price||0).toLocaleString('vi-VN')}đ`
        : 'Chưa cập nhật';

    let html = `
    <div class="food-popup-card" data-place-id="${placeId}">
        <img src="${imgSrc}" alt="${place.name}" onerror="this.src='https://via.placeholder.com/260x95?text=No+Image'">
        <h4>${place.name}</h4>
        <p class="food-tag">${place.category_name || ''}</p>
    `;

    if (loggedIn) {
        // ── Thông tin chi tiết ──
        let destination = encodeURIComponent(place.address);
        if (place.geom && place.geom.coordinates) {
            const [lng, lat] = place.geom.coordinates;
            destination = `${lat},${lng}`;
        }
        html += `
        <div class="place-meta">
            <p><i class="fa-solid fa-location-dot"></i> ${place.address}</p>
            <p><i class="fa-solid fa-clock"></i> ${timeStr}</p>
            <p><i class="fa-solid fa-tag"></i> ${priceStr}</p>
            <p><i class="fa-solid fa-star" style="color:#e67e22"></i>
               ${place.avg_rating?.toFixed(1) || '–'} (${place.total_reviews} đánh giá)</p>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" class="btn-navigate">
                <i class="fa-solid fa-map-location-dot"></i> Dẫn đường Google Maps
            </a>
        </div>
        <hr class="popup-divider">
        `;

        // ── Bình luận ──
        const reviews = place.reviews || [];
        const myReview = reviews.find(r => r.user === userId);

        html += `<div class="comment-section">
            <h5><i class="fa-regular fa-comments"></i> Bình luận (${reviews.length})</h5>
            <div class="comment-list" id="cmt-list-${placeId}">`;

        if (reviews.length === 0) {
            html += `<p class="no-comment">Chưa có bình luận nào. Hãy là người đầu tiên!</p>`;
        } else {
            reviews.forEach(r => {
                const isOwner = r.user === userId;
                const date = new Date(r.created_at).toLocaleDateString('vi-VN');
                const avatarHtml = r.user_avatar 
                    ? `<img src="${r.user_avatar}" class="cmt-avatar-img" alt="avatar">` 
                    : `<div class="cmt-avatar-icon"><i class="fa-solid fa-user"></i></div>`;
                
                html += `
                <div class="comment-item" id="cmt-${r.id}">
                    <div class="cmt-header">
                        ${avatarHtml}
                        <div class="cmt-info">
                            <div class="cmt-info-top">
                                <b class="cmt-author">${r.username}</b>
                                <span class="cmt-stars">${renderStars(r.rating)}</span>
                                <span class="cmt-date">${date}</span>
                            </div>
                            <p class="cmt-text" id="cmt-text-${r.id}">${escapeHtml(r.comment || '')}</p>
                        </div>
                    </div>
                    ${isOwner ? `
                    <div class="cmt-actions">
                        <button class="btn-cmt-action btn-cmt-edit" onclick="window._editComment(${r.id}, ${placeId})">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                        <button class="btn-cmt-action btn-cmt-delete" onclick="window._deleteComment(${r.id}, ${placeId})">
                            <i class="fa-solid fa-trash"></i> Xóa
                        </button>
                    </div>` : ''}
                </div>`;
            });
        }

        html += `</div>`; // end comment-list

        // ── Form gửi bình luận ──
        if (myReview) {
            // Đã có review → hiện nút cập nhật
            html += `
            <div class="comment-form" id="cmt-form-${placeId}">
                <div class="star-input" id="star-input-${placeId}" data-rating="${myReview.rating}">
                    ${[1,2,3,4,5].map(i => `<i class="fa-solid fa-star star-btn ${i <= myReview.rating ? 'selected' : ''}"
                        data-val="${i}" onclick="window._selectStar(${placeId}, ${i})"></i>`).join('')}
                </div>
                <input type="text" id="input-cmt-${placeId}"
                    value="${escapeHtml(myReview.comment || '')}"
                    placeholder="Cập nhật bình luận..."
                    data-review-id="${myReview.id}">
                <button onclick="window._submitComment(${placeId})">
                    <i class="fa-solid fa-rotate"></i> Cập nhật
                </button>
            </div>`;
        } else {
            // Chưa có review → form tạo mới
            html += `
            <div class="comment-form" id="cmt-form-${placeId}">
                <div class="star-input" id="star-input-${placeId}" data-rating="5">
                    ${[1,2,3,4,5].map(i => `<i class="fa-solid fa-star star-btn ${i <= 5 ? 'selected' : ''}"
                        data-val="${i}" onclick="window._selectStar(${placeId}, ${i})"></i>`).join('')}
                </div>
                <input type="text" id="input-cmt-${placeId}"
                    placeholder="Nhập bình luận của bạn..."
                    data-review-id="">
                <button onclick="window._submitComment(${placeId})">
                    <i class="fa-solid fa-paper-plane"></i> Gửi
                </button>
            </div>`;
        }

        html += `</div>`; // end comment-section
    } else {
        // Chưa đăng nhập
        html += `
        <div class="locked-info-box">
            <i class="fa-solid fa-lock"></i>
            <p>Vui lòng <a href="login.html">Đăng nhập</a> để xem địa chỉ và bình luận.</p>
        </div>`;
    }

    html += `</div>`; // end food-popup-card
    return html;
}

// ─────────────────────────────────────────────
//  HELPER: escape HTML để tránh XSS
// ─────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ─────────────────────────────────────────────
//  GLOBAL HANDLERS (gắn vào window để Leaflet popup gọi được)
// ─────────────────────────────────────────────

// Chọn rating bằng sao
window._selectStar = function(placeId, val) {
    const container = document.getElementById(`star-input-${placeId}`);
    if (!container) return;
    container.dataset.rating = val;
    container.querySelectorAll('.star-btn').forEach((s, idx) => {
        s.classList.toggle('selected', idx < val);
    });
};

// Gửi / cập nhật bình luận (upsert logic)
window._submitComment = async function(placeId) {
    const inputEl  = document.getElementById(`input-cmt-${placeId}`);
    const starEl   = document.getElementById(`star-input-${placeId}`);
    const reviewId = inputEl?.dataset.reviewId;
    const text     = inputEl?.value.trim();
    const rating   = parseInt(starEl?.dataset.rating || '5', 10);

    if (!text) { showToast('Vui lòng nhập nội dung bình luận.', 'warning'); return; }

    let result;
    if (reviewId) {
        // Đã có review → PATCH
        result = await updateReview(parseInt(reviewId, 10), text, rating);
    } else {
        // Chưa có → POST
        result = await createReview(placeId, text, rating);
    }

    if (result.ok) {
        showToast(reviewId ? 'Đã cập nhật bình luận!' : 'Đã gửi bình luận!', 'success');
        // Reload popup bằng cách rebuild content
        await refreshPopup(placeId);
    } else {
        showToast(result.error, 'error');
    }
};

// Sửa inline: focus vào input
window._editComment = function(reviewId, placeId) {
    const textEl  = document.getElementById(`cmt-text-${reviewId}`);
    const inputEl = document.getElementById(`input-cmt-${placeId}`);
    if (textEl && inputEl) {
        inputEl.value = textEl.textContent;
        inputEl.dataset.reviewId = reviewId;
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

// Xóa bình luận
window._deleteComment = async function(reviewId, placeId) {
    if (!confirm('Bạn có chắc muốn xóa bình luận này không?')) return;
    const result = await deleteReview(reviewId);
    if (result.ok) {
        showToast('Đã xóa bình luận.', 'success');
        await refreshPopup(placeId);
    } else {
        showToast(result.error, 'error');
    }
};

// Reload nội dung popup sau khi thêm/sửa/xóa review
async function refreshPopup(placeId) {
    // Tìm leaflet-popup đang mở chứa card của quán này
    const popupEl = document.querySelector(`.food-popup-card[data-place-id="${placeId}"]`);
    if (!popupEl) return;
    const contentEl = popupEl.closest('.leaflet-popup-content');
    if (contentEl) {
        contentEl.innerHTML = '<div class="popup-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang cập nhật...</div>';
        const newHtml = await buildPopupContent(placeId);
        contentEl.innerHTML = newHtml;
        // Cập nhật kích thước popup sau khi đổi nội dung
        map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer.isPopupOpen()) {
                layer.getPopup()?.update();
            }
        });
    }
}

// ─────────────────────────────────────────────
//  ICON THEO CATEGORY
// ─────────────────────────────────────────────
function getCategoryIcon(categoryName) {
    const cat = (categoryName || '').toLowerCase();
    let color = '#e67e22'; // cam – mặc định
    let icon  = 'fa-utensils';

    if (cat.includes('cà phê') || cat.includes('cafe') || cat.includes('trà')) {
        color = '#8e44ad'; icon = 'fa-mug-hot';
    } else if (cat.includes('nhà hàng') || cat.includes('restaurant')) {
        color = '#c0392b'; icon = 'fa-building';
    } else if (cat.includes('đặc sản') || cat.includes('vùng miền')) {
        color = '#27ae60'; icon = 'fa-leaf';
    } else if (cat.includes('đường phố') || cat.includes('street')) {
        color = '#e67e22'; icon = 'fa-fire-burner';
    } else if (cat.includes('bánh') || cat.includes('dessert')) {
        color = '#e91e8c'; icon = 'fa-cookie-bite';
    }

    return L.divIcon({
        className: '',
        html: `<div style="
            background:${color};
            width:32px; height:32px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:2px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex; align-items:center; justify-content:center;">
            <i class='fa-solid ${icon}' style='color:#fff; font-size:12px; transform:rotate(45deg);'></i>
        </div>`,
        iconSize:   [32, 32],
        iconAnchor: [16, 32],
        popupAnchor:[0, -34],
    });
}

// ─────────────────────────────────────────────
//  LOADING OVERLAY TRÊN BẢN ĐỒ
// ─────────────────────────────────────────────
function showMapLoading(on) {
    let overlay = document.getElementById('map-loading-overlay');
    if (on) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'map-loading-overlay';
            overlay.innerHTML = `
                <div class="map-loader-box">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Đang tải dữ liệu bản đồ...</span>
                </div>`;
            document.getElementById('map').appendChild(overlay);
        }
    } else {
        overlay?.remove();
    }
}

// ─────────────────────────────────────────────
//  RENDER MARKERS TỪ GEOJSON API
// ─────────────────────────────────────────────
async function loadAndRenderMarkers(categoryFilter = 'all') {
    showMapLoading(true);
    try {
        const geoData = await getFoodPlacesGeoJSON(categoryFilter);

        if (!geoData) {
            showToast('Không kết nối được server.', 'error');
            return;
        }

        let features = [];
        if (geoData.type === 'FeatureCollection' && Array.isArray(geoData.features)) {
            features = geoData.features;
        } else if (Array.isArray(geoData)) {
            features = geoData.map(p => ({
                type: 'Feature',
                id: p.id,
                geometry: p.geom,
                properties: { ...p },
            }));
        }
        
        renderFoodMarkers(features);
    } catch (err) {
        console.error(err);
        showToast('Lỗi tải dữ liệu.', 'error');
    } finally {
        showMapLoading(false);
    }
}

function renderFoodMarkers(features) {
    foodMarkersLayer.clearLayers();
    currentHeatmapData = [];

    features.forEach(feature => {
        const props  = feature.properties || {};
        const coords = feature.geometry?.coordinates;
        if (!coords) return;

        const placeId = feature.id ?? props.id;
        const icon = getCategoryIcon(props.category_name);
        const marker = L.marker([coords[1], coords[0]], { icon });
        marker.placeId = placeId;

        marker.bindTooltip(
            `<b>${props.name || 'Quán ăn'}</b><br><small>${props.category_name || ''}</small>`,
            { direction: 'top', offset: [0, -30], className: 'fm-tooltip' }
        );

        const popup = L.popup({ minWidth: 290, maxWidth: 310 })
            .setContent(`<div class="popup-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải...</div>`);
        marker.bindPopup(popup);

        marker.on('popupopen', async () => {
            const html = await buildPopupContent(placeId);
            popup.setContent(html);
            popup.update();
        });

        marker.addTo(foodMarkersLayer);
        
        // Thêm dữ liệu cho heatmap
        const totalReviews = props.total_reviews || 0;
        if (totalReviews > 0) {
            // Tọa độ [lat, lng, cường_độ]
            // Cường độ có thể nhân hệ số để nhìn rõ hơn
            currentHeatmapData.push([coords[1], coords[0], totalReviews * 0.5]);
        }
    });

    // Cập nhật heatmap layer nếu đang bật
    if (isHeatmapActive) {
        enableHeatmap(true);
    }
}


// ─────────────────────────────────────────────
//  CATEGORY FILTER BUTTONS DYNAMIC RENDER
// ─────────────────────────────────────────────
async function loadAndRenderCategories() {
    const categoryBar = document.getElementById('category-bar');
    if (!categoryBar) return;

    try {
        const categories = await getCategories();
        
        // Giữ lại nút Tất Cả
        categoryBar.innerHTML = '<button class="btn-category active" data-type="all">Tất Cả</button>';
        
        // Thêm các nút từ API
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'btn-category';
            btn.dataset.type = cat.name;
            
            // Map icon đơn giản cho nút
            let iconClass = 'fa-utensils';
            const catLower = cat.name.toLowerCase();
            if (catLower.includes('cà phê') || catLower.includes('trà')) iconClass = 'fa-mug-hot';
            else if (catLower.includes('nhà hàng')) iconClass = 'fa-shop';
            else if (catLower.includes('đặc sản')) iconClass = 'fa-leaf';
            else if (catLower.includes('bánh') || catLower.includes('chè') || catLower.includes('ăn vặt')) iconClass = 'fa-cookie-bite';
            
            btn.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${cat.name}`;
            categoryBar.appendChild(btn);
        });

        // Gắn sự kiện click cho các nút
        categoryBar.querySelectorAll('.btn-category').forEach(button => {
            button.addEventListener('click', (e) => {
                categoryBar.querySelectorAll('.btn-category').forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const type = e.currentTarget.dataset.type;
                loadAndRenderMarkers(type);
                loadAndRenderTopRated(type);
            });
        });

        // Hỗ trợ cuộn ngang bằng con lăn chuột
        categoryBar.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                categoryBar.scrollLeft += e.deltaY;
            }
        });
    } catch (err) {
        console.error('Lỗi tải danh mục:', err);
    }
}

// ─────────────────────────────────────────────
//  TÌM KIẾM ĐỊA ĐIỂM (GEOCODING)
// ─────────────────────────────────────────────
document.getElementById('btn-search').addEventListener('click', runGeocodingSearch);
document.getElementById('address-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runGeocodingSearch();
});

async function runGeocodingSearch() {
    const query = document.getElementById('address-input').value.trim();
    if (!query) return;
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=vn&q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        if (data.length > 0) {
            map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14);
        } else {
            showToast('Không tìm thấy địa điểm trên bản đồ Việt Nam.', 'warning');
        }
    } catch (err) {
        console.error(err);
        showToast('Lỗi tìm kiếm. Vui lòng thử lại.', 'error');
    }
}

// ─────────────────────────────────────────────
//  BẢN ĐỒ NHIỆT (HEATMAP) DỰA THEO LƯỢT BÌNH LUẬN
// ─────────────────────────────────────────────
function initHeatmapToggle() {
    const btnToggle = document.getElementById('btn-toggle-heatmap');
    if (!btnToggle) return;

    btnToggle.addEventListener('click', () => {
        isHeatmapActive = !isHeatmapActive;
        if (isHeatmapActive) {
            btnToggle.classList.add('active-heatmap');
            enableHeatmap(true);
        } else {
            btnToggle.classList.remove('active-heatmap');
            enableHeatmap(false);
        }
    });
}

function enableHeatmap(active) {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    if (active) {
        // Tắt lớp marker đi cho dễ nhìn heatmap
        map.removeLayer(foodMarkersLayer);
        
        // Tạo lớp heatmap mới
        heatLayer = L.heatLayer(currentHeatmapData, {
            radius: 25,
            blur: 15,
            maxZoom: 15,
            max: 5 // Giới hạn max weight để màu sắc lên đẹp
        }).addTo(map);
    } else {
        // Bật lại lớp marker
        map.addLayer(foodMarkersLayer);
    }
}

// ─────────────────────────────────────────────
//  BẢNG XẾP HẠNG TOP 10 QUÁN ĂN (RANKING)
// ─────────────────────────────────────────────
async function loadAndRenderTopRated(category = 'all') {
    const listContainer = document.getElementById('ranking-list');
    if (!listContainer) return;

    try {
        const places = await getTopRatedFoodPlaces(category);
        if (!places || places.length === 0) {
            listContainer.innerHTML = '<div style="padding:10px; font-size:11px; color:#888;">Chưa có dữ liệu đánh giá.</div>';
            return;
        }

        let html = '';
        places.forEach((p, index) => {
            const numReviews = p.total_reviews || 0;
            const avgRating = p.avg_rating ? p.avg_rating.toFixed(1) : '–';
            
            // Xếp hạng huy chương
            let rankIcon = `<b>#${index + 1}</b>`;
            if (index === 0) rankIcon = `<i class="fa-solid fa-medal" style="color: gold;"></i>`;
            else if (index === 1) rankIcon = `<i class="fa-solid fa-medal" style="color: silver;"></i>`;
            else if (index === 2) rankIcon = `<i class="fa-solid fa-medal" style="color: #cd7f32;"></i>`; // bronze

            html += `
                <div class="ranking-item" data-id="${p.id}">
                    <div class="rank-name">${rankIcon} ${escapeHtml(p.name)}</div>
                    <div class="rank-rating">
                        <span><i class="fa-solid fa-star"></i> ${avgRating} (${numReviews} đánh giá)</span>
                    </div>
                    <div class="rank-cat">${escapeHtml(p.category_name || '')}</div>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;

        // Bấm vào quán trong bảng xếp hạng -> Zoom tới & mở popup
        listContainer.querySelectorAll('.ranking-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                // Tìm marker có id tương ứng và trigger click (popup)
                let targetMarker = null;
                foodMarkersLayer.eachLayer(layer => {
                    if (layer.placeId == id) targetMarker = layer;
                });
                
                if (targetMarker) {
                    map.setView(targetMarker.getLatLng(), 16);
                    targetMarker.openPopup();
                } else {
                    showToast('Vui lòng chọn danh mục "Tất cả" trên thanh công cụ để xem quán này trên bản đồ', 'info');
                }
            });
        });

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div style="padding:10px; font-size:11px; color:red;">Lỗi tải xếp hạng.</div>';
    }
}

// ─────────────────────────────────────────────
//  KHỞI CHẠY
// ─────────────────────────────────────────────
loadAndRenderCategories();
loadAndRenderMarkers('all');
initHeatmapToggle();
loadAndRenderTopRated();