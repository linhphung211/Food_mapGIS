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
            // Lưu toàn bộ thông tin phiên làm việc (token + session_id + user)
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
            body: JSON.stringify({ username, email, password }),
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
    return res.json();
}

/**
 * Lấy danh sách quán ăn dạng GeoJSON để đổ lên bản đồ
 * Endpoint công khai – không cần đăng nhập
 */
export async function getFoodPlacesGeoJSON(category = 'all') {
    let url = '/api/storefronts/foodplaces/?type=geojson';
    if (category !== 'all') {
        url += `&category=${encodeURIComponent(category)}`;
    }
    const res = await apiFetch(url, {
        skipAuthRedirect: true,  // Công khai, không redirect về login
    });
    if (!res || !res.ok) return null;
    return res.json();
}

/**
 * Lấy chi tiết 1 quán ăn (kèm danh sách reviews)
 */
export async function getFoodPlaceDetail(id) {
    const res = await apiFetch(`/api/storefronts/foodplaces/${id}/`);
    if (!res || !res.ok) return null;
    return res.json();
}

/**
 * Lấy top 10 quán ăn đánh giá cao
 */
export async function getTopRated() {
    const res = await apiFetch('/api/storefronts/foodplaces/top_rated/');
    if (!res || !res.ok) return null;
    return res.json();
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
export async function createReview(foodPlaceId, comment, rating = 5) {
    const res = await apiFetch('/api/reviews/', {
        method: 'POST',
        body: JSON.stringify({ food_place: foodPlaceId, comment, rating }),
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const data = await res.json();
    if (res.ok) return { ok: true, data };
    const msg = Object.values(data).flat().join(' ');
    return { ok: false, error: msg || 'Không thể gửi bình luận.' };
}

/**
 * Cập nhật bình luận (PATCH)
 */
export async function updateReview(reviewId, comment, rating) {
    const body = {};
    if (comment !== undefined) body.comment = comment;
    if (rating !== undefined) body.rating = rating;
    const res = await apiFetch(`/api/reviews/${reviewId}/`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    const data = await res.json();
    if (res.ok) return { ok: true, data };
    return { ok: false, error: 'Không thể cập nhật bình luận.' };
}

/**
 * Xóa bình luận
 */
export async function deleteReview(reviewId) {
    const res = await apiFetch(`/api/reviews/${reviewId}/`, { method: 'DELETE' });
    if (!res) return { ok: false, error: 'Lỗi kết nối.' };
    if (res.status === 204) return { ok: true };
    return { ok: false, error: 'Không thể xóa bình luận.' };
}
