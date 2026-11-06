/**
 * JEEVA — Frontend API Connector
 * Drop this file next to index.html and include it with:
 * <script src="api.js"></script>
 *
 * It replaces all localStorage-only logic with real API calls.
 * Usage: window.API.login(email, pass), window.API.register(data), etc.
 */

const API = (() => {

const BASE = 'http://localhost:5000/api';

  // ── Token helpers ────────────────────────────
  const getToken = ()       => localStorage.getItem('jeeva_token');
  const setToken = (t)      => localStorage.setItem('jeeva_token', t);
  const clearToken = ()     => localStorage.removeItem('jeeva_token');
  const setUser  = (u)      => localStorage.setItem('jeeva_user', JSON.stringify(u));
  const getUser  = ()       => JSON.parse(localStorage.getItem('jeeva_user') || 'null');
  const clearUser = ()      => localStorage.removeItem('jeeva_user');
  const isLoggedIn = ()     => !!getToken();

  // ── Base fetch wrapper ───────────────────────
  async function request(method, endpoint, body = null, auth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers, credentials: 'include' };
    if (body) options.body = JSON.stringify(body);

    try {
      const res  = await fetch(`${BASE}${endpoint}`, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      throw err;
    }
  }

  // ════════════════════════════════════════════
  //  AUTH
  // ════════════════════════════════════════════

  async function register(userData) {
    const data = await request('POST', '/auth/register', userData);
    setToken(data.token);
    setUser(data.user);
    updateNavbar(data.user);
    return data;
  }

  async function login(email, password) {
    const data = await request('POST', '/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    updateNavbar(data.user);
    // Sync localStorage cart to server
    syncCart();
    return data;
  }

  async function logout() {
    try { await request('POST', '/auth/logout', null, true); } catch {}
    clearToken();
    clearUser();
    updateNavbar(null);
    window.location.href = 'index.html';
  }

  async function getMe() {
    return await request('GET', '/auth/me', null, true);
  }

  async function forgotPassword(email) {
    return await request('POST', '/auth/forgotpassword', { email });
  }

  async function resetPassword(token, password) {
    return await request('PUT', `/auth/resetpassword/${token}`, { password });
  }

  async function updateProfile(data) {
    const res = await request('PUT', '/auth/updateprofile', data, true);
    setUser(res.user);
    return res;
  }

  // ════════════════════════════════════════════
  //  PRODUCTS
  // ════════════════════════════════════════════

  async function getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await request('GET', `/products?${qs}`);
  }

  async function getProduct(id) {
    return await request('GET', `/products/${id}`);
  }

  async function getRelated(id) {
    return await request('GET', `/products/${id}/related`);
  }

  async function searchProducts(query) {
    return await request('GET', `/products?search=${encodeURIComponent(query)}`);
  }

  async function addReview(productId, rating, comment) {
    return await request('POST', `/products/${productId}/reviews`, { rating, comment }, true);
  }

  // ════════════════════════════════════════════
  //  ORDERS
  // ════════════════════════════════════════════

  async function placeOrder(orderData) {
    return await request('POST', '/orders', orderData, true);
  }

  async function getMyOrders(page = 1) {
    return await request('GET', `/orders/my?page=${page}`, null, true);
  }

  async function getOrder(id) {
    return await request('GET', `/orders/${id}`, null, true);
  }

  async function cancelOrder(id, reason = '') {
    return await request('PUT', `/orders/${id}/cancel`, { reason }, true);
  }

  // ════════════════════════════════════════════
  //  CART SYNC
  // ════════════════════════════════════════════

  async function syncCart() {
    if (!isLoggedIn()) return;
    try {
      const localCart = JSON.parse(localStorage.getItem('jeeva_cart') || '[]');
      if (localCart.length === 0) return;
      await request('POST', '/cart/sync', { items: localCart.map(i => ({
        productId: i.productId,
        qty:       i.qty,
        size:      i.size || '',
      }))}, true);
    } catch (e) {
      console.warn('Cart sync failed:', e.message);
    }
  }

  // ════════════════════════════════════════════
  //  NAVBAR — swap auth buttons when logged in
  // ════════════════════════════════════════════

  function updateNavbar(user) {
    const authDiv = document.querySelector('.nav-auth');
    if (!authDiv) return;

    if (user) {
      authDiv.innerHTML = `
        <span style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin-right:4px">
          Hi, ${user.firstName}
        </span>
        <button class="btn-login" onclick="window.API.logout()" style="gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Log out
        </button>
      `;
    } else {
      authDiv.innerHTML = `
        <a href="login.html" class="btn-login">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Log in
        </a>
        <a href="signup.html" class="btn-signup">
          <span>🎁</span> Sign up
        </a>
      `;
    }
  }

  // ── Auto-restore session on page load ───────
  function init() {
    const user = getUser();
    if (user && isLoggedIn()) updateNavbar(user);
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── Public API ───────────────────────────────
  return {
    // Auth
    register, login, logout, getMe,
    forgotPassword, resetPassword, updateProfile,
    isLoggedIn, getUser,
    // Products
    getProducts, getProduct, getRelated, searchProducts, addReview,
    // Orders
    placeOrder, getMyOrders, getOrder, cancelOrder,
    // Cart
    syncCart,
    // Nav
    updateNavbar,
  };

})();

window.API = API;
