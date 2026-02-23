const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
let csrfToken = "";

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

function setCsrfToken(nextToken) {
  csrfToken = typeof nextToken === "string" ? nextToken : "";
}

async function refreshSession() {
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("session expired");
  }

  try {
    const payload = await res.json();
    setCsrfToken(payload?.csrfToken || "");
  } catch (_error) {
    setCsrfToken("");
  }
}

async function parseResponse(res) {
  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error || message;
    } catch (_error) {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return null;
  }

  const payload = await res.json();
  if (payload && typeof payload === "object" && "csrfToken" in payload) {
    setCsrfToken(payload.csrfToken);
  }
  return payload;
}

async function request(path, options = {}, retry = true) {
  const method = String(options.method || "GET").toUpperCase();
  const requiresCsrf = path.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (requiresCsrf && !csrfToken) {
    await refreshSession();
  }

  const res = await fetch(buildUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(requiresCsrf && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      await refreshSession();
      return request(path, options, false);
    } catch (_error) {
      throw new Error("session expired");
    }
  }

  return parseResponse(res);
}

export function signup(payload) {
  return request("/auth/signup", { method: "POST", body: JSON.stringify(payload) });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function logout() {
  setCsrfToken("");
  return request("/auth/logout", { method: "POST" });
}

export function me() {
  return request("/auth/me");
}

export function fetchCampaigns() {
  return request("/api/campaigns");
}

export function fetchMyCampaigns() {
  return request("/api/campaigns/mine");
}

export function closeCampaign(id) {
  return request(`/api/campaigns/${id}/close`, { method: "PATCH" });
}

export function createCampaign(payload) {
  return request("/api/campaigns", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchMatches() {
  return request("/api/matches");
}

export function fetchMatchRecommendations(campaignId) {
  return request(`/api/matches/recommendations?campaignId=${campaignId}`);
}

export function createMatch(payload) {
  return request("/api/matches", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchInfluencers() {
  return request("/api/users/influencers");
}

export function fetchProposals() {
  return request("/api/proposals");
}

export function createProposal(payload) {
  return request("/api/proposals", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProposalStatus(id, status) {
  return request(`/api/proposals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function fetchMyProfile() {
  return request("/api/users/profile");
}

export function updateInfluencerProfile(payload) {
  return request("/api/users/profile", { method: "PATCH", body: JSON.stringify(payload) });
}

export function fetchApplications() {
  return request("/api/applications");
}

export function createApplication(payload) {
  return request("/api/applications", { method: "POST", body: JSON.stringify(payload) });
}

export function updateApplicationStatus(id, status) {
  return request(`/api/applications/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function fetchTransactions() {
  return request("/api/transactions");
}

export function createTransaction(payload) {
  return request("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
}

export function releaseTransaction(id) {
  return request(`/api/transactions/${id}/release`, { method: "PATCH" });
}

export function refundTransaction(id) {
  return request(`/api/transactions/${id}/refund`, { method: "PATCH" });
}

export function fetchTransactionReceipt(id) {
  return request(`/api/transactions/${id}/receipt`);
}

export function fetchBrandAnalytics() {
  return request("/api/analytics/brand");
}

export function fetchInfluencerAnalytics() {
  return request("/api/analytics/influencer");
}

export function fetchRecentNotifications() {
  return request("/api/notifications/recent");
}

export function createNotificationsEventSource(onMessage) {
  const streamUrl = buildUrl("/api/notifications/stream");
  const source = new EventSource(streamUrl, { withCredentials: true });
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (_error) {
      // Ignore malformed notification payloads.
    }
  };
  return source;
}

export function fetchAdminOverview() {
  return request("/api/admin/overview");
}

export function fetchAdminUsers(role) {
  const suffix = role ? `?role=${encodeURIComponent(role)}` : "";
  return request(`/api/admin/users${suffix}`);
}

export function updateAdminFraudFlag(userId, isFraudFlagged) {
  return request(`/api/admin/users/${userId}/fraud-flag`, {
    method: "PATCH",
    body: JSON.stringify({ isFraudFlagged })
  });
}

export function fetchAdminAuditLogs(limit = 50) {
  return request(`/api/admin/audit-logs?limit=${limit}`);
}

export function runAdminFraudScan() {
  return request("/api/admin/fraud-scan", { method: "POST" });
}

export function fetchMediaAssets() {
  return request("/api/media");
}

export function createMediaAsset(payload) {
  return request("/api/media", { method: "POST", body: JSON.stringify(payload) });
}
