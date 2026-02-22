const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function refreshSession() {
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("session expired");
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

  return res.json();
}

async function request(path, options = {}, retry = true) {
  const res = await fetch(buildUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
