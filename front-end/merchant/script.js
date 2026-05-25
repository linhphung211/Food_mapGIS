/**
 * script.js – Front-end User: Bản đồ ăn uống Việt Nam
 * Tích hợp đầy đủ API backend (JWT auth, reviews CRUD, GeoJSON foodplaces)
 */
import {
    isLoggedIn, getUsername, getAvatar, logout,
    getFoodPlacesGeoJSON, getFoodPlaceDetail,
    createFoodPlace, updateFoodPlace, deleteFoodPlace, uploadFoodPlaceImage,
    replyReview, updateReply, deleteReply,
    getCategories, getMyFoodPlaces,
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
    const defaultImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='95'%3E%3Crect width='260' height='95' fill='%23eee'/%3E%3Ctext x='130' y='50' font-family='sans-serif' font-size='14' text-anchor='middle' fill='%23aaa'%3EKh%C3%B4ng c%C3%B3 %E1%BA%A3nh%3C/text%3E%3C/svg%3E";
    const imgSrc = place.images?.[0]?.image || defaultImg;

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
        <img src="${imgSrc}" alt="${place.name}" onerror="this.onerror=null; this.src='${defaultImg}'">
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
        <div class="cmt-actions" style="margin-top:10px; display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="window._openEditPlaceModal(${placeId})" style="font-size:12px; padding:5px 10px;">
                <i class="fa-solid fa-pen-to-square"></i> Sửa quán
            </button>
            <button class="btn btn-danger" onclick="window._deletePlace(${placeId})" style="font-size:12px; padding:5px 10px;">
                <i class="fa-solid fa-trash"></i> Xóa quán
            </button>
        </div>
        <hr class="popup-divider">
        `;

        // ── Bình luận ──
        const reviews = place.reviews || [];

        html += `<div class="comment-section">
            <h5><i class="fa-regular fa-comments"></i> Bình luận (${reviews.length})</h5>
            <div class="comment-list" id="cmt-list-${placeId}">`;

        if (reviews.length === 0) {
            html += `<p class="no-comment">Chưa có bình luận nào.</p>`;
        } else {
            reviews.forEach(r => {
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
                            <p class="cmt-text">${escapeHtml(r.comment || '')}</p>
                        </div>
                    </div>
                `;

                // Reply from merchant
                if (r.reply) {
                    html += `
                    <div class="cmt-reply">
                        <div class="cmt-reply-author"><i class="fa-solid fa-store"></i> Phản hồi của bạn:</div>
                        <div class="cmt-reply-text" id="reply-text-${r.reply.id}">${escapeHtml(r.reply.content)}</div>
                        <div class="cmt-actions" style="margin-top:5px;">
                            <button type="button" class="btn-cmt-reply" onclick="window._editReply(${r.id}, ${r.reply.id}, ${placeId})">Sửa</button>
                            <button type="button" class="btn-cmt-reply" style="color:red;" onclick="window._deleteReply(${r.id}, ${placeId})">Xóa</button>
                        </div>
                    </div>
                    `;
                } else {
                    html += `
                    <div class="cmt-actions" style="margin-top:5px;">
                        <button type="button" class="btn-cmt-reply" onclick="window._toggleReplyForm(${r.id})">Trả lời</button>
                    </div>
                    `;
                }

                html += `
                    <div id="reply-form-${r.id}" class="reply-form" style="display:none; margin-top:5px; gap:5px;">
                        <input type="text" id="input-reply-${r.id}" placeholder="Nhập phản hồi..." style="flex:1; padding:5px; font-size:12px; border:1px solid #ccc; border-radius:4px;">
                        <button type="button" class="btn btn-primary" onclick="window._submitReply(${r.id}, ${placeId})" style="padding: 5px 10px; font-size:12px;">Gửi</button>
                    </div>
                </div>`;
            });
        }

        html += `</div></div>`; // end comment-list & comment-section
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

// ─────────────────────────────────────────────
//  GLOBAL HANDLERS (gắn vào window để Leaflet popup gọi được)
// ─────────────────────────────────────────────

window._toggleReplyForm = function(reviewId) {
    const form = document.getElementById(`reply-form-${reviewId}`);
    if (form) {
        form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    }
};

window._editReply = function(reviewId, replyId, placeId) {
    const textEl = document.getElementById(`reply-text-${replyId}`);
    const form = document.getElementById(`reply-form-${reviewId}`);
    const input = document.getElementById(`input-reply-${reviewId}`);
    if (form && textEl && input) {
        form.style.display = 'flex';
        input.value = textEl.textContent;
        input.dataset.replyId = replyId;
    }
};

window._submitReply = async function(reviewId, placeId) {
    const input = document.getElementById(`input-reply-${reviewId}`);
    const content = input?.value.trim();
    if (!content) { showToast('Vui lòng nhập nội dung.', 'warning'); return; }

    const replyId = input.dataset.replyId;
    let res;
    if (replyId) {
        res = await updateReply(reviewId, content);
    } else {
        res = await replyReview(reviewId, content);
    }

    if (res.ok) {
        showToast('Đã gửi phản hồi', 'success');
        await refreshPopup(placeId);
    } else {
        showToast(res.error, 'error');
    }
};

window._deleteReply = async function(reviewId, placeId) {
    if (!confirm('Bạn có chắc muốn xóa phản hồi?')) return;
    const res = await deleteReply(reviewId);
    if (res.ok) {
        showToast('Đã xóa phản hồi', 'success');
        await refreshPopup(placeId);
    } else {
        showToast(res.error, 'error');
    }
};

window._refreshPopup = refreshPopup;

// --- Add / Edit / Delete Place ---
window._openEditPlaceModal = async function(placeId) {
    const popupEl = document.querySelector(`.food-popup-card[data-place-id="${placeId}"]`);
    if (!popupEl) return;
    const contentEl = popupEl.closest('.leaflet-popup-content');
    if (!contentEl) return;

    const place = await getFoodPlaceDetail(placeId);
    if (!place) return;

    const lat = place.geom && place.geom.coordinates ? place.geom.coordinates[1] : '';
    const lng = place.geom && place.geom.coordinates ? place.geom.coordinates[0] : '';
    const openTime = place.opening_time ? place.opening_time.substring(0,5) : '';
    const closeTime = place.closing_time ? place.closing_time.substring(0,5) : '';

    const html = `
    <div class="food-popup-card" data-place-id="${placeId}" style="min-width: 250px;">
        <h4 style="text-align:center; color: var(--accent-color); margin-bottom: 10px;">Sửa Quán</h4>
        <form onsubmit="window._submitEditPlacePopup(event, ${placeId})">
            <input type="hidden" id="edit-popup-lat" value="${lat}">
            <input type="hidden" id="edit-popup-lng" value="${lng}">
            
            <input type="text" id="edit-popup-name" value="${place.name || ''}" placeholder="Tên quán *" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            <select id="edit-popup-category" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                ${categoryOptionsHtml}
            </select>
            <input type="text" id="edit-popup-address" value="${place.address || ''}" placeholder="Địa chỉ *" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            
            <div style="display:flex; gap:8px; margin-bottom:8px; width: 100%;">
                <input type="time" id="edit-popup-open" value="${openTime}" title="Giờ mở cửa" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                <input type="time" id="edit-popup-close" value="${closeTime}" title="Giờ đóng cửa" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px; width: 100%;">
                <input type="number" id="edit-popup-min-price" value="${place.min_price || ''}" placeholder="Giá thấp nhất" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                <input type="number" id="edit-popup-max-price" value="${place.max_price || ''}" placeholder="Giá cao nhất" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <input type="file" id="edit-popup-image" accept="image/*" title="Tải ảnh mới lên" style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            <textarea id="edit-popup-desc" placeholder="Mô tả chi tiết..." rows="2" style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: none;">${place.description || ''}</textarea>
            
            <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary" onclick="event.preventDefault(); event.stopPropagation(); window._refreshPopup(${placeId})" style="box-sizing: border-box; flex: 1; padding: 8px;">Hủy</button>
                <button type="submit" class="btn btn-primary" style="box-sizing: border-box; flex: 1; padding: 8px;"><i class="fa-solid fa-check"></i> Lưu</button>
            </div>
        </form>
    </div>`;

    contentEl.innerHTML = html;
    
    // Chọn đúng category sau khi render html
    const catSelect = document.getElementById('edit-popup-category');
    if (catSelect && place.category) {
        catSelect.value = place.category;
    }
};

window._deletePlace = async function(placeId) {
    if (!confirm('Bạn có chắc muốn xóa quán này?')) return;
    const res = await deleteFoodPlace(placeId);
    if (res.ok) {
        showToast('Đã xóa quán', 'success');
        loadAndRenderMarkers('all');
        loadAndRenderTopRated();
    } else {
        showToast(res.error, 'error');
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
async function loadAndRenderMarkers(categoryFilter = 'all', fetchAll = false) {
    showMapLoading(true);
    try {
        const geoData = await getFoodPlacesGeoJSON(categoryFilter, fetchAll);

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
                loadAndRenderMarkers(type, isAddingPlace);
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
//  BẢN ĐỒ: THÊM QUÁN (ADD PLACE FLOW)
// ─────────────────────────────────────────────
let isAddingPlace = false;
function initAddPlaceToggle() {
    const btnAdd = document.getElementById('btn-add-place');
    if (!btnAdd) return;

    btnAdd.addEventListener('click', () => {
        isAddingPlace = !isAddingPlace;
        if (isAddingPlace) {
            // Hiển thị tất cả các quán hiện có trên toàn hệ thống để tránh chọn trùng
            loadAndRenderMarkers('all', true);

            btnAdd.classList.add('active-heatmap');
            document.getElementById('map').classList.add('map-crosshair');
            showToast('Hãy nhấp vào một điểm trên bản đồ Cầu Giấy để thêm quán.', 'info');
            map.closePopup();
        } else {
            btnAdd.classList.remove('active-heatmap');
            document.getElementById('map').classList.remove('map-crosshair');
            // Tải lại chỉ danh sách quán của mình khi tắt chế độ thêm
            loadAndRenderMarkers('all');
        }
    });

    map.on('click', (e) => {
        if (!isAddingPlace) return;
        
        // Kiểm tra xem có trùng tọa độ (gần quá 15 mét) với quán nào hiện có không
        let isDuplicate = false;
        foodMarkersLayer.eachLayer(layer => {
            if (layer.getLatLng && e.latlng.distanceTo(layer.getLatLng()) < 15) {
                isDuplicate = true;
            }
        });
        
        if (isDuplicate) {
            showToast('Vị trí này đã có quán (hoặc quá gần). Vui lòng chọn vị trí khác!', 'error');
            return;
        }

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Check bounds
        const bounds = L.latLngBounds(cauGiayBounds);
        if (!bounds.contains(e.latlng)) {
            showToast('Vui lòng chọn vị trí trong khu vực Cầu Giấy.', 'warning');
            return;
        }

        const html = `
        <div class="food-popup-card" style="min-width: 250px;">
            <h4 style="text-align:center; color: var(--accent-color); margin-bottom: 10px;">Thêm Quán Mới</h4>
            <form onsubmit="window._submitAddPlacePopup(event)">
                <input type="hidden" id="popup-lat" value="${lat}">
                <input type="hidden" id="popup-lng" value="${lng}">
                
                <input type="text" id="popup-name" placeholder="Tên quán *" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                <select id="popup-category" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    ${categoryOptionsHtml}
                </select>
                <input type="text" id="popup-address" placeholder="Địa chỉ *" required style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                
                <div style="display:flex; gap:8px; margin-bottom:8px; width: 100%;">
                    <input type="time" id="popup-open" title="Giờ mở cửa" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <input type="time" id="popup-close" title="Giờ đóng cửa" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <div style="display:flex; gap:8px; margin-bottom:8px; width: 100%;">
                    <input type="number" id="popup-min-price" placeholder="Giá thấp nhất" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <input type="number" id="popup-max-price" placeholder="Giá cao nhất" style="box-sizing: border-box; flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <input type="file" id="popup-image" accept="image/*" style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                <textarea id="popup-desc" placeholder="Mô tả chi tiết..." rows="2" style="box-sizing: border-box; width: 100%; margin-bottom: 8px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; resize: none;"></textarea>
                
                <button type="submit" class="btn btn-primary" style="box-sizing: border-box; width: 100%; padding: 8px;"><i class="fa-solid fa-check"></i> Lưu Quán</button>
            </form>
        </div>`;

        L.popup({ 
            maxWidth: 320,
            autoPanPaddingTopLeft: [0, 120] // Tránh bị che bởi top-bar
        })
            .setLatLng(e.latlng)
            .setContent(html)
            .openOn(map);

        // Reset state
        isAddingPlace = false;
        btnAdd.classList.remove('active-heatmap');
        document.getElementById('map').classList.remove('map-crosshair');
        map.setMaxBounds(null);
        map.setMinZoom(0);
    });

    // Handle Popup Submission
    window._submitAddPlacePopup = async function(e) {
        e.preventDefault();
        const data = {
            name: document.getElementById('popup-name').value,
            category: document.getElementById('popup-category').value,
            address: document.getElementById('popup-address').value,
            opening_time: document.getElementById('popup-open').value || null,
            closing_time: document.getElementById('popup-close').value || null,
            min_price: document.getElementById('popup-min-price').value || null,
            max_price: document.getElementById('popup-max-price').value || null,
            description: document.getElementById('popup-desc').value,
            geom: {
                type: "Point",
                coordinates: [
                    parseFloat(document.getElementById('popup-lng').value),
                    parseFloat(document.getElementById('popup-lat').value)
                ]
            }
        };

        const res = await createFoodPlace(data);
        if (res.ok) {
            const imageInput = document.getElementById('popup-image');
            if (imageInput && imageInput.files[0]) {
                const imgRes = await uploadFoodPlaceImage(res.data.id, imageInput.files[0]);
                if (!imgRes.ok) {
                    showToast('Tạo quán thành công nhưng tải ảnh lên bị lỗi: ' + imgRes.error, 'warning');
                } else {
                    showToast('Thêm quán và ảnh thành công', 'success');
                }
            } else {
                showToast('Thêm quán thành công', 'success');
            }
            
            map.closePopup();
            loadAndRenderMarkers('all');
            loadAndRenderTopRated();
        } else {
            showToast(res.error, 'error');
        }
    };

    window._submitEditPlacePopup = async function(e, id) {
        e.preventDefault();
        const data = {
            name: document.getElementById('edit-popup-name').value,
            category: document.getElementById('edit-popup-category').value,
            address: document.getElementById('edit-popup-address').value,
            opening_time: document.getElementById('edit-popup-open').value || null,
            closing_time: document.getElementById('edit-popup-close').value || null,
            min_price: document.getElementById('edit-popup-min-price').value || null,
            max_price: document.getElementById('edit-popup-max-price').value || null,
            description: document.getElementById('edit-popup-desc').value,
            geom: {
                type: "Point",
                coordinates: [
                    parseFloat(document.getElementById('edit-popup-lng').value),
                    parseFloat(document.getElementById('edit-popup-lat').value)
                ]
            }
        };

        const res = await updateFoodPlace(id, data);
        if (res.ok) {
            const imageInput = document.getElementById('edit-popup-image');
            if (imageInput && imageInput.files[0]) {
                const imgRes = await uploadFoodPlaceImage(id, imageInput.files[0]);
                if (!imgRes.ok) {
                    showToast('Cập nhật quán thành công nhưng tải ảnh lên bị lỗi: ' + imgRes.error, 'warning');
                } else {
                    showToast('Cập nhật quán và ảnh thành công', 'success');
                }
            } else {
                showToast('Cập nhật quán thành công', 'success');
            }
            await loadAndRenderMarkers('all');
            loadAndRenderTopRated();
            // Re-open popup
            const newLayer = foodMarkersLayer.getLayers().find(l => l.placeId === id);
            if (newLayer) newLayer.openPopup();
        } else {
            showToast(res.error, 'error');
        }
    };

    // Form Edit submission
    document.getElementById('place-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('place-id').value;
        const data = {
            name: document.getElementById('place-name').value,
            category: document.getElementById('place-category').value,
            address: document.getElementById('place-address').value,
            phone: document.getElementById('place-phone').value,
            opening_time: document.getElementById('place-open').value || null,
            closing_time: document.getElementById('place-close').value || null,
            min_price: document.getElementById('place-min-price').value || null,
            max_price: document.getElementById('place-max-price').value || null,
            description: document.getElementById('place-desc').value,
            geom: {
                type: "Point",
                coordinates: [
                    parseFloat(document.getElementById('place-lng').value),
                    parseFloat(document.getElementById('place-lat').value)
                ]
            }
        };

        if (id) {
            const res = await updateFoodPlace(id, data);
            if (res.ok) {
                showToast('Cập nhật quán thành công', 'success');
                document.getElementById('place-modal').classList.add('hidden');
                loadAndRenderMarkers('all');
                loadAndRenderTopRated();
            } else {
                showToast(res.error, 'error');
            }
        }
    });

    document.getElementById('place-modal-close').addEventListener('click', () => {
        document.getElementById('place-modal').classList.add('hidden');
    });
    document.getElementById('place-modal-cancel').addEventListener('click', () => {
        document.getElementById('place-modal').classList.add('hidden');
    });
}

// ─────────────────────────────────────────────
//  BẢNG XẾP HẠNG / QUÁN CỦA TÔI
// ─────────────────────────────────────────────
async function loadAndRenderTopRated(category = 'all') {
    const listContainer = document.getElementById('ranking-list');
    if (!listContainer) return;

    try {
        const places = await getMyFoodPlaces(category);
        if (!places || places.length === 0) {
            listContainer.innerHTML = '<div style="padding:10px; font-size:11px; color:#888;">Chưa có quán nào.</div>';
            return;
        }

        let html = '';
        places.forEach((p, index) => {
            const numReviews = p.total_reviews || 0;
            const avgRating = p.avg_rating ? p.avg_rating.toFixed(1) : '–';
            
            html += `
                <div class="ranking-item" data-id="${p.id}">
                    <div class="rank-name"><i class="fa-solid fa-store" style="color:var(--accent-color);"></i> ${escapeHtml(p.name)}</div>
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

let categoryOptionsHtml = '<option value="">-- Chọn danh mục --</option>';

async function initCategorySelect() {
    const categories = await getCategories();
    const sel = document.getElementById('place-category');
    if (sel) {
        sel.innerHTML = '<option value="">-- Chọn danh mục --</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            sel.appendChild(opt);
            
            categoryOptionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
        });
    } else {
        categories.forEach(cat => {
            categoryOptionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
}

loadAndRenderCategories();
loadAndRenderMarkers('all');
initAddPlaceToggle();
loadAndRenderTopRated();
initCategorySelect();