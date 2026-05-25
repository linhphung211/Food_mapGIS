/**
 * api.js – Module tập trung tất cả API call cho Food Map User Front-end
 * Sử dụng JWT Access + Refresh Token (lưu trong localStorage)
 */

const BASE_URL = 'http://localhost:8000';

// ─────────────────────────────────────────────
//  TOKEN HELPERS
// ─────────────────────────────────────────────
export function getAccessToken()  { return localStorage.getItem('access_token'); }
export function getRefreshToken() { return localStorage.getItem('refresh_token'); }
export function getUsername()     { return localStorage.getItem('username'); }
export function getAvatar()       { return localStorage.getItem('avatar'); }
export function getSessionId()    { return localStorage.getItem('session_id'); }
export function isLoggedIn()      { return !!getAccessToken(); }

function saveTokens({ access, refresh, session_id, user }) {
    localStorage.setItem('access_token', access);
    if (refresh)    localStorage.setItem('refresh_token', refresh);
    if (session_id) localStorage.setItem('session_id', session_id);
    if (user) {
        localStorage.setItem('username', user.username || '');
        localStorage.setItem('user_id',  String(user.id || ''));
        if (user.avatar) localStorage.setItem('avatar', user.avatar);
        else localStorage.removeItem('avatar');
    }
}

function clearSession() {
    ['access_token', 'refresh_token', 'session_id', 'username', 'user_id', 'avatar', 'isLoggedIn'].forEach(
        k => localStorage.removeItem(k)
    );
}

// ─────────────────────────────────────────────
//  FETCH WRAPPER – tự động đính Bearer token
//  và tự động refresh nếu 401
// ─────────────────────────────────────────────
async function apiFetch(path, options = {}, retry = true) {
    const token = getAccessToken();
    const headers = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const { skipAuthRedirect, ...fetchOptions } = options;

    if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers });

    // Hết hạn access token → thử refresh (chỉ khi đang đăng nhập)
    if (response.status === 401 && retry && token) {
        const refreshed = await tryRefreshToken();
        if (refreshed) return apiFetch(path, options, false); // 1 lần retry
        // Chỉ redirect nếu endpoint yêu cầu auth
        if (!skipAuthRedirect) {
            clearSession();
            window.location.href = 'login.html';
        }
        return null;
    }
    return response;

}

// Làm mới access token bằng refresh token
async function tryRefreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
        const res = await fetch(`${BASE_URL}/api/users/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        saveTokens({ access: data.access, refresh: data.refresh });
        return true;
    } catch { return false; }
}

// ─────────────────────────────────────────────
//  AUTH APIs
// ─────────────────────────────────────────────

/**
 * Đăng nhập – trả về { ok, data, error }
 * Backend /api/users/login/ trả về: { access, refresh, role, session_id, user:{...} }
 */
export async function login(username, password) {
    try {
        const res = await fetch(`${BASE_URL}/api/users/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.ok) {
            if (data.role !== 'merchant') {
                return { ok: false, error: 'Tài khoản này không phải Người bán hàng.' };
            }
            saveTokens({
                access:     data.access,
                refresh:    data.refresh,
                session_id: data.session_id,
                user:       data.user,
            });
            return { ok: true, data };
        }
        const msg = data.error || data.detail || data.non_field_errors?.[0] || 'Tên đăng nhập hoặc mật khẩu không đúng.';
        return { ok: false, error: msg };
    } catch (e) {
        return { ok: false, error: 'Không kết nối được đến server.' };
    }
}

/**
 * Đăng ký – trả về { ok, data, error }
 */
export async function register(username, email, password) {
    try {
        const res = await fetch(`${BASE_URL}/api/users/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role: 'merchant' }),
        });
        const data = await res.json();
        if (res.ok) return { ok: true, data };
        // Gom lỗi từ nhiều field
        const msgs = Object.values(data).flat().join(' ');
        return { ok: false, error: msgs || 'Đăng ký thất bại.' };
    } catch (e) {
        return { ok: false, error: 'Không kết nối được đến server.' };
    }
}

/**
 * Đăng xuất – gọi API rồi xóa toàn bộ session local
 */
export async function logout() {
    try {
        const sessionId = getSessionId();
        if (sessionId) {
            await apiFetch('/api/users/logout/', {
                method: 'POST',
                body: JSON.stringify({ session_id: sessionId }),
            });
        }
    } catch (_) { /* bỏ qua lỗi logout */ }
    clearSession();
}

/**
 * Lấy thông tin cá nhân
 */
export async function getMe() {
    const res = await apiFetch('/api/users/me/');
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (data.avatar) localStorage.setItem('avatar', data.avatar);
    else localStorage.removeItem('avatar');
    return data;
}

/**
 * Cập nhật thông tin cá nhân
 */
export async function updateUserProfile(data) {
    const isFormData = data instanceof FormData;
    const res = await apiFetch('/api/users/update_profile/', {
        method: 'PATCH',
        body: isFormData ? data : JSON.stringify(data),
    });
    if (!res || !res.ok) throw new Error('Không thể cập nhật thông tin');
    const json = await res.json();
    if (json.data && json.data.avatar) {
        localStorage.setItem('avatar', json.data.avatar);
    } else if (json.data && !json.data.avatar) {
        localStorage.removeItem('avatar');
    }
    return json;
}

// ─────────────────────────────────────────────
//  FOOD PLACE APIs
// ─────────────────────────────────────────────

/**
 * Lấy danh sách các danh mục quán ăn
 */
export async function getCategories() {
    const res = await apiFetch('/api/storefronts/categories/', {
        skipAuthRedirect: true,
    });
    if (!res || !res.ok) return [];
    return res.json();
}

/**
 * Lấy danh sách top 10 quán ăn đánh giá cao nhất
 */
export async function getTopRatedFoodPlaces(category = 'all') {
    let url = '/api/storefronts/foodplaces/top_rated/';
    if (category && category !== 'all') {
        url += `?category=${encodeURIComponent(category)}`;
    }
    const res = await apiFetch(url, {
        skipAuthRedirect: true,
    });
    if (!res || !res.ok) return [];
    const data = await res.json();
    // Vì bảng xếp hạng lấy của hệ thống, nhưng để tiện cho merchant, mình sẽ vẫn trả về bảng xếp hạng này hoặc danh sách các quán của merchant.
    // Thực tế trong script.js ta sẽ dùng một hàm khác để hiển thị "Quán của tôi".
    return data;
}

export async function getMyFoodPlaces(category = 'all') {
    let url = '/api/storefronts/foodplaces/?manage=true';
    if (category !== 'all') {
        url += `&category=${encodeURIComponent(category)}`;
    }
    const res = await apiFetch(url);
    if (!res || !res.ok) return [];
    return res.json();
}

/**
 * Lấy danh sách quán ăn dạng GeoJSON để đổ lên bản đồ
 * Endpoint công khai – không cần đăng nhập
 */
export async function getFoodPlacesGeoJSON(category = 'all', fetchAll = false) {
    let url = fetchAll ? '/api/storefronts/foodplaces/?type=geojson' : '/api/storefronts/foodplaces/?manage=true';
    if (category !== 'all') {
        url += `&category=${encodeURIComponent(category)}`;
    }
    const res = await apiFetch(url);
    if (!res || !res.ok) return null;
    const data = await res.json();
    
    // Nếu fetchAll = true, API trả về sẵn GeoJSON (do dùng FoodPlaceMapSerializer)
    if (fetchAll) return data;

    // Nếu fetchAll = false, API trả về list, cần convert sang GeoJSON
    return {
        type: 'FeatureCollection',
        features: data.map(p => ({
            type: 'Feature',
            id: p.id,
            geometry: p.geom,
            properties: { ...p }
        }))
    };
}

export async function getFoodPlaceDetail(id) {
    const res = await apiFetch(`/api/storefronts/foodplaces/${id}/`);
    if (!res || !res.ok) return null;
    return res.json();
}

export async function createFoodPlace(data) {
    const res = await apiFetch('/api/storefronts/foodplaces/', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { 
        ok: false, 
        error: Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') 
    };
}

export async function updateFoodPlace(id, data) {
    const res = await apiFetch(`/api/storefronts/foodplaces/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { 
        ok: false, 
        error: Object.entries(json).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') 
    };
}

export async function uploadFoodPlaceImage(id, file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await apiFetch(`/api/storefronts/foodplaces/${id}/upload_image/`, {
        method: 'POST',
        body: formData
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error || 'Tải ảnh lên thất bại.' };
}

export async function deleteFoodPlace(id) {
    const res = await apiFetch(`/api/storefronts/foodplaces/${id}/`, { method: 'DELETE' });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    return res.status === 204 ? { ok: true } : { ok: false, error: 'Không thể xóa quán.' };
}

// ─────────────────────────────────────────────
//  REVIEW APIs
// ─────────────────────────────────────────────

/**
 * Lấy danh sách bình luận của một quán
 */
export async function getReviewsByPlace(foodPlaceId) {
    const res = await apiFetch(`/api/reviews/?food_place_id=${foodPlaceId}`);
    if (!res || !res.ok) return [];
    return res.json();
}

/**
 * Tạo mới bình luận
 */
export async function replyReview(reviewId, content) {
    const res = await apiFetch(`/api/reviews/${reviewId}/reply/`, {
        method: 'POST',
        body: JSON.stringify({ content })
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error || Object.values(json).flat().join(' ') };
}

export async function updateReply(reviewId, content) {
    const res = await apiFetch(`/api/reviews/${reviewId}/reply/`, {
        method: 'PATCH',
        body: JSON.stringify({ content })
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error || Object.values(json).flat().join(' ') };
}

export async function deleteReply(reviewId) {
    const res = await apiFetch(`/api/reviews/${reviewId}/reply/`, { method: 'DELETE' });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    return res.status === 204 ? { ok: true } : { ok: false, error: 'Không thể xóa phản hồi.' };
}
