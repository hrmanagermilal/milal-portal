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

// External events are already matched to a specific room (title format
// "장소-목적") and resolved server-side, so render each as one item.
// Callers poll getReservations() roughly every 5s; throttle the external
// calendar fetch to 3x that interval so it doesn't hit Google that often.
const EXTERNAL_EVENTS_CACHE_TTL_MS = 15000;
let _externalEventsCache = { items: [], fetchedAt: 0 };
let _externalEventsInFlight = null;

async function fetchExternalReservationLikeItems() {
  if (!sessionStorage.getItem("milal_token")) return [];

  const isFresh = Date.now() - _externalEventsCache.fetchedAt < EXTERNAL_EVENTS_CACHE_TTL_MS;
  if (isFresh) return _externalEventsCache.items;
  if (_externalEventsInFlight) return _externalEventsInFlight;

  _externalEventsInFlight = (async () => {
    try {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const end = new Date();
      end.setDate(end.getDate() + 60);
      const events = await request(
        `/api/calendar/external-events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
        { headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` } }
      );
      const items = events.map((ev) => ({
        id: ev.id,
        room_id: ev.room_id,
        room_name: ev.room_name,
        requester_name: ev.requester_name,
        phone: "",
        email: "",
        purpose: ev.purpose,
        attendees: 0,
        notes: "",
        start_time: ev.start_time,
        end_time: ev.end_time,
        status: "external",
        admin_comment: "",
        external: true,
      }));
      _externalEventsCache = { items, fetchedAt: Date.now() };
      return items;
    } catch {
      return []; // not logged in, or the integration isn't configured — skip silently
    } finally {
      _externalEventsInFlight = null;
    }
  })();

  return _externalEventsInFlight;
}

export const api = {
  getRooms: () => request("/api/rooms"),
  getRoomRules: () => request("/api/rooms/rules"),
  getAvailableRooms: (startTime, endTime) =>
    request(
      `/api/rooms/available?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`
    ),
  getReservations: async () => {
    const [reservations, externalItems] = await Promise.all([
      request("/api/reservations"),
      fetchExternalReservationLikeItems(),
    ]);
    return [...reservations, ...externalItems];
  },
  getExternalCalendarEvents: (startIso, endIso) =>
    request(
      `/api/calendar/external-events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      { headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` } }
    ),
  adminGetRooms: () =>
    request("/api/admin/rooms", {
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  adminCreateRoom: (payload) =>
    request("/api/admin/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminUpdateRoom: (id, payload) =>
    request(`/api/admin/rooms/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminDeleteRoom: (id) =>
    request(`/api/admin/rooms/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  adminSaveRoomLocation: (roomId, payload) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  adminGetRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  adminGetAllRoomLocations: () =>
    request("/api/admin/rooms/locations/all", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  adminDeleteRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  
  // ── Room Reservation Rules ────────────────────────────────────────────
  adminGetRoomRules: (roomId) =>
    request(`/api/admin/rooms/${roomId}/rules`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),
  
  adminCreateRoomRule: (roomId, payload) =>
    request(`/api/admin/rooms/${roomId}/rules`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  
  adminUpdateRoomRule: (roomId, ruleId, payload) =>
    request(`/api/admin/rooms/${roomId}/rules/${ruleId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
      body: payload,
    }),
  
  adminDeleteRoomRule: (roomId, ruleId) =>
    request(`/api/admin/rooms/${roomId}/rules/${ruleId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
      },
    }),

  createReservation: (payload) =>
    request("/api/reservations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),
  updateReservation: (id, payload) =>
    request(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),
  deleteReservation: (id) =>
    request(`/api/reservations/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),
  adminUpdateReservation: (id, payload) =>
    request(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}`,
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
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  updateMyAccountInfo: (payload) =>
    request("/api/auth/me", {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  getCellGroupMembers: () =>
    request("/api/auth/cell-group-members", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  createCellReport: (payload) =>
    request("/api/cell-reports", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  getCellReports: () =>
    request("/api/cell-reports", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getCellReportDetail: (reportId) =>
    request(`/api/cell-reports/${reportId}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getCellReportDateAnalysis: (meetingDate) =>
    request(`/api/cell-reports/date-analysis?meeting_date=${encodeURIComponent(meetingDate)}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenses: () =>
    request("/api/expenses", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenseRequesterProfile: () =>
    request("/api/expenses/requester-profile", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenseApprovers: () =>
    request("/api/expenses/approvers", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpense: (expenseId) =>
    request(`/api/expenses/${expenseId}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  createExpense: (payload) =>
    request("/api/expenses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  updateExpense: (expenseId, payload) =>
    request(`/api/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  cancelExpense: (expenseId) =>
    request(`/api/expenses/${expenseId}/cancel`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  extractExpenseReceipt: (fileDataUrl) =>
    request("/api/expenses/extract-receipt", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { file_data_url: fileDataUrl },
    }),
  getExpenseApprovalSummary: () =>
    request("/api/expense-approvals/summary", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenseApprovals: (status = "") =>
    request(`/api/expense-approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  decideExpenseApproval: (expenseId, action, comment, accountId, secondApproverMemberId) =>
    request(`/api/expense-approvals/${expenseId}/decision`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { action, comment, account_id: accountId || null, second_approver_member_id: secondApproverMemberId || null },
    }),

  getExpenseAccounts: () =>
    request("/api/expense-accounts", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  createExpenseAccount: (payload) =>
    request("/api/expense-accounts", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  updateExpenseAccount: (accountId, payload) =>
    request(`/api/expense-accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  deleteExpenseAccount: (accountId) =>
    request(`/api/expense-accounts/${accountId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenseAccount: (accountId) =>
    request(`/api/expense-accounts/${accountId}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  getExpenseApprovalRoutes: () =>
    request("/api/expense-approval-routes", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  saveExpenseApprovalRoute: (accountId, payload) =>
    request(`/api/expense-accounts/${accountId}/approval-route`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  getMember: (memberId) =>
    request(`/api/auth/member/${memberId}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  updateMember: (memberId, payload) =>
    request(`/api/auth/member/${memberId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),

  // ── Admin User Management ─────────────────────────────────────────────
  adminGetUsers: (skip = 0, limit = 20, query = "") =>
    request(`/api/auth/admin/users?skip=${skip}&limit=${limit}&query=${encodeURIComponent(query)}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),
  adminGetUserCount: (query = "") =>
    request(`/api/auth/admin/users/total?query=${encodeURIComponent(query)}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),
  adminUpdateMemberAccessible: (memberId, accessible) =>
    request(`/api/auth/admin/members/${memberId}/accessible`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { accessible },
    }),
  adminGetUserDetail: (userId) =>
    request(`/api/auth/admin/users/${userId}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),
  adminUpdateUserPermission: (userId, payload) =>
    request(`/api/auth/admin/users/${userId}/admin`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: payload,
    }),
  adminUpdateUserAdmin: (userId, isAdmin) =>
    request(`/api/auth/admin/users/${userId}/admin`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { permission: isAdmin ? "admin" : "member" },
    }),
  adminUpdateUserFinanceAdmin: (userId, isFinanceAdmin) =>
    request(`/api/auth/admin/users/${userId}/finance-admin`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { is_finance_admin: isFinanceAdmin },
    }),
  adminResetUserPassword: (userId) =>
    request(`/api/auth/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),
    
  // ── Change Password ────────────────────────────────────────────────────
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/change-password", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: { current_password: currentPassword, new_password: newPassword },
    }),

  // ── Room Location ──────────────────────────────────────────────────────
  adminSaveRoomLocation: (roomId, coordinates) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
      body: coordinates,
    }),

  adminGetRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  adminGetAllRoomLocations: () =>
    request("/api/admin/rooms/locations/all", {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  adminDeleteRoomLocation: (roomId) =>
    request(`/api/admin/rooms/${roomId}/location`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("milal_token")}` },
    }),

  // ── AI Chat ────────────────────────────────────────────────────────────
  fetchEncouragingVerse: (language = "ko") =>
    request(`/api/chat/encouraging-verse?language=${encodeURIComponent(language)}`),

  sendChat: (payload) =>
    request("/api/chat", {
      method: "POST",
      body: payload,
    }),
};
