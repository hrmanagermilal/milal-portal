import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function buildApiBaseCandidates() {
  if (!import.meta.env.DEV) {
    return [API_BASE || ""];
  }

  // In WSL/Windows mixed setups, Vite proxy can fail while direct browser access works.
  const candidates = ["", API_BASE, "http://127.0.0.1:7000", "http://localhost:7000"].filter(Boolean);
  return [...new Set(candidates)];
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
  adminGetRooms: (adminKey) =>
    request("/api/admin/rooms", {
      headers: {
        "X-Admin-Key": adminKey,
      },
    }),
  adminCreateRoom: (payload, adminKey) =>
    request("/api/admin/rooms", {
      method: "POST",
      headers: {
        "X-Admin-Key": adminKey,
      },
      body: payload,
    }),
  adminUpdateRoom: (id, payload, adminKey) =>
    request(`/api/admin/rooms/${id}`, {
      method: "PATCH",
      headers: {
        "X-Admin-Key": adminKey,
      },
      body: payload,
    }),
  adminDeleteRoom: (id, adminKey) =>
    request(`/api/admin/rooms/${id}`, {
      method: "DELETE",
      headers: {
        "X-Admin-Key": adminKey,
      },
    }),
  createReservation: (payload) =>
    request("/api/reservations", {
      method: "POST",
      body: payload,
    }),
  adminUpdateReservation: (id, payload, adminKey) =>
    request(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: {
        "X-Admin-Key": adminKey,
      },
      body: payload,
    }),
};
