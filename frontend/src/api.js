import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function buildApiBaseCandidates() {
  return [API_BASE || ""];
}

function normalizeErrorDetail(detail) {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const where = Array.isArray(item.loc) ? item.loc.join(".") : "field";
          const msg = item.msg || JSON.stringify(item);
          return `${where}: ${msg}`;
        }
        return String(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return "";
}

async function request(path, options = {}) {
  const candidates = buildApiBaseCandidates();
  let lastError = null;
  const method = options.method || "GET";
  const requestData = options.body;

  for (const base of candidates) {
    try {
      const response = await axios({
        url: `${base}${path}`,
        method,
        headers: {
          ...(requestData !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
        data: requestData,
        validateStatus: () => true,
      });

      const contentType = response.headers?.["content-type"] || "";
      const isJson = contentType.includes("application/json");
      const ok = response.status >= 200 && response.status < 300;

      if (!ok) {
        if (isJson) {
          const body = response.data;
          const detail = normalizeErrorDetail(body?.detail);
          throw new Error(detail || JSON.stringify(body) || `Request failed: ${response.status}`);
        }
        const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data || "");
        throw new Error(text || `Request failed: ${response.status}`);
      }

      if (!isJson) {
        const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data || "");
        throw new Error(`Expected JSON but received ${contentType || "unknown content type"}: ${text.slice(0, 120)}`);
      }

      return response.data;
    } catch (err) {
      const isNetworkError = axios.isAxiosError(err) && !err.response;

      lastError = err;
      if (!isNetworkError) {
        throw err;
      }
    }
  }

  throw new Error(
    `${lastError?.message || "Failed to fetch"}. ` +
      `Backend is unreachable. Tried: ${candidates.join(", ")}. ` +
      "Ensure API server is running at http://127.0.0.1:7000 or set VITE_API_BASE_URL."
  );
}

export const api = {
  getRooms: () => request("/api/rooms"),
  getReservations: () => request("/api/reservations"),
  adminGetRooms: () =>
    request("/api/admin/rooms", {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
    }),
  adminCreateRoom: (payload) =>
    request("/api/admin/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminUpdateRoom: (id, payload) =>
    request(`/api/admin/rooms/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminDeleteRoom: (id) =>
    request(`/api/admin/rooms/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
    }),
  adminSaveRoomLocation: (roomId, payload) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminGetRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
    }),
  adminGetAllRoomLocations: () =>
    request("/api/admin/rooms/locations/all", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
    }),
  adminDeleteRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
    }),
  createReservation: (payload) =>
    request("/api/reservations", {
      method: "POST",
      body: payload,
    }),
  adminUpdateReservation: (id, payload) =>
    request(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),

  // ── Auth / Member account ──────────────────────────────────────────────
  findMember: (payload) =>
    request("/api/auth/find-member", { method: "POST", body: payload }),

  sendOtp: (payload) =>
    request("/api/auth/send-otp", { method: "POST", body: payload }),

  verifyOtp: (payload) =>
    request("/api/auth/verify-otp", { method: "POST", body: payload }),

  checkUserId: (payload) =>
    request("/api/auth/check-userid", { method: "POST", body: payload }),

  createAccount: (payload) =>
    request("/api/auth/create-account", { method: "POST", body: payload }),

  loginWithPassword: (payload) =>
    request("/api/auth/login", { method: "POST", body: payload }),

  getMyAccountInfo: () =>
    request("/api/auth/me", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  updateMyAccountInfo: (payload) =>
    request("/api/auth/me", {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
      body: payload,
    }),

  getCellGroupMembers: () =>
    request("/api/auth/cell-group-members", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  getMember: (memberId) =>
    request(`/api/auth/member/${memberId}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  updateMember: (memberId, payload) =>
    request(`/api/auth/member/${memberId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
      body: payload,
    }),

  // ── Admin User Management ─────────────────────────────────────────────
  adminGetUsers: (skip = 0, limit = 20) =>
    request(`/api/auth/admin/users?skip=${skip}&limit=${limit}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),
  adminGetUserCount: () =>
    request("/api/auth/admin/users/total", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),
  adminGetUserDetail: (userId) =>
    request(`/api/auth/admin/users/${userId}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),
  adminUpdateUserPermission: (userId, payload) =>
    request(`/api/auth/admin/users/${userId}/admin`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
      body: payload,
    }),
  adminResetUserPassword: (userId) =>
    request(`/api/auth/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),
    
  // ── Change Password ────────────────────────────────────────────────────
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/change-password", {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
      body: { current_password: currentPassword, new_password: newPassword },
    }),

  // ── Room Location ──────────────────────────────────────────────────────
  adminSaveRoomLocation: (roomId, coordinates) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
      body: coordinates,
    }),

  adminGetRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  adminGetAllRoomLocations: () =>
    request("/api/admin/rooms/locations/all", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  adminDeleteRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("milal_token")}` },
    }),

  // ── AI Chat ────────────────────────────────────────────────────────────
  sendChat: (payload) =>
    request("/api/chat", {
      method: "POST",
      body: payload,
    }),
};
