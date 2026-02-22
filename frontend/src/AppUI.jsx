import { useEffect, useMemo, useRef, useState } from "react";
import {
  closeCampaign,
  createCampaign,
  createMatch,
  createProposal,
  fetchCampaigns,
  fetchInfluencers,
  fetchMatches,
  fetchMyCampaigns,
  fetchProposals,
  login,
  logout,
  me,
  signup,
  updateProposalStatus
} from "./api";

const initialAuth = { name: "", email: "", password: "", role: "BRAND" };
const initialCampaign = { title: "", budget: "", description: "" };
const initialMatch = { campaignId: "", influencerId: "" };
const initialProposal = { matchId: "", deliverables: "", amount: "" };
const ROLE_LABELS = { BRAND: "Brand", INFLUENCER: "Influencer" };

function Stat({ label, value }) {
  return (
    <article className="stat">
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
    </article>
  );
}

function StatusChip({ value }) {
  return <span className={`status-chip status-${String(value || "").toLowerCase()}`}>{value}</span>;
}

export default function App() {
  const searchRef = useRef(null);

  const [authMode, setAuthMode] = useState("login");
  const [authRole, setAuthRole] = useState("BRAND");
  const [authForm, setAuthForm] = useState(initialAuth);
  const [campaignForm, setCampaignForm] = useState(initialCampaign);
  const [matchForm, setMatchForm] = useState(initialMatch);
  const [proposalForm, setProposalForm] = useState(initialProposal);

  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [matches, setMatches] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("ALL");
  const [campaignSort, setCampaignSort] = useState("NEWEST");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isBrand = user?.role === "BRAND";
  const hasMatches = matches.length > 0;
  const roleTheme = (user?.role || authRole).toLowerCase();

  const normalizedQuery = query.trim().toLowerCase();
  const roleLabel = user ? ROLE_LABELS[user.role] : ROLE_LABELS[authRole];

  const acceptanceRate = useMemo(() => {
    if (!proposals.length) return 0;
    const accepted = proposals.filter((proposal) => proposal.status === "ACCEPTED").length;
    return Math.round((accepted / proposals.length) * 100);
  }, [proposals]);

  const stats = useMemo(
    () => [
      { label: "Live Campaigns", value: campaigns.filter((campaign) => campaign.status === "OPEN").length },
      { label: "Your Matches", value: matches.length },
      { label: "Proposals", value: proposals.length },
      { label: "Acceptance Rate", value: `${acceptanceRate}%` }
    ],
    [campaigns, matches, proposals, acceptanceRate]
  );

  const filteredCampaigns = useMemo(() => {
    const filtered = campaigns.filter((campaign) => {
      const statusOk = campaignStatusFilter === "ALL" || campaign.status === campaignStatusFilter;
      if (!statusOk) return false;
      if (!normalizedQuery) return true;

      const haystack = `${campaign.title} ${campaign.description || ""} ${campaign.status}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const sorted = [...filtered];
    if (campaignSort === "BUDGET_HIGH") sorted.sort((a, b) => b.budget - a.budget);
    if (campaignSort === "BUDGET_LOW") sorted.sort((a, b) => a.budget - b.budget);
    if (campaignSort === "TITLE") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (campaignSort === "NEWEST") sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [campaigns, campaignStatusFilter, campaignSort, normalizedQuery]);

  const filteredMatches = useMemo(() => {
    if (!normalizedQuery) return matches;
    return matches.filter((match) => {
      const haystack = `${match.campaign?.title || ""} ${match.status || ""} ${match.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [matches, normalizedQuery]);

  const filteredProposals = useMemo(() => {
    if (!normalizedQuery) return proposals;
    return proposals.filter((proposal) => {
      const haystack = `${proposal.deliverables || ""} ${proposal.status || ""} ${proposal.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [proposals, normalizedQuery]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    });
  }

  async function loadData(options = {}) {
    const { silent = false } = options;
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const allCampaigns = await fetchCampaigns();
      setCampaigns(allCampaigns);

      let meData;
      try {
        meData = await me();
        setUser(meData);
      } catch (_authError) {
        setUser(null);
        setMatches([]);
        setProposals([]);
        setMyCampaigns([]);
        setInfluencers([]);
        setError("");
        setLastUpdated(new Date());
        return;
      }

      const baseRequests = [fetchMatches(), fetchProposals()];
      const brandRequests = meData.role === "BRAND" ? [fetchMyCampaigns(), fetchInfluencers()] : [];
      const data = await Promise.all([...baseRequests, ...brandRequests]);

      setMatches(data[0]);
      setProposals(data[1]);

      if (meData.role === "BRAND") {
        setMyCampaigns(data[2]);
        setInfluencers(data[3]);
      } else {
        setMyCampaigns([]);
        setInfluencers([]);
      }

      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadData({ silent: false });
  }, []);

  useEffect(() => {
    if (!user || !autoRefresh) return undefined;
    const timer = setInterval(() => {
      loadData({ silent: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [user, autoRefresh]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "/" && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-role-theme", roleTheme);
  }, [roleTheme]);

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll(".panel, .auth-card, .stat, .control-panel, .btn-primary")
    );

    if (!targets.length) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const states = new Map();
    let rafId = null;

    const onMove = (event) => {
      const el = event.currentTarget;
      const state = states.get(el);
      if (!state) return;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
      const rotateY = ((x / rect.width) * 2 - 1) * 1.8;
      const rotateX = ((y / rect.height) * 2 - 1) * -1.8;

      state.targetX = px;
      state.targetY = py;
      state.targetRx = rotateX;
      state.targetRy = rotateY;
    };

    const onLeave = (event) => {
      const state = states.get(event.currentTarget);
      if (!state) return;
      state.targetX = 50;
      state.targetY = 50;
      state.targetRx = 0;
      state.targetRy = 0;
    };

    const animate = () => {
      let stillAnimating = false;
      for (const [el, state] of states.entries()) {
        state.x += (state.targetX - state.x) * 0.14;
        state.y += (state.targetY - state.y) * 0.14;
        state.rx += (state.targetRx - state.rx) * 0.14;
        state.ry += (state.targetRy - state.ry) * 0.14;

        el.style.setProperty("--mx", `${state.x.toFixed(2)}%`);
        el.style.setProperty("--my", `${state.y.toFixed(2)}%`);
        el.style.setProperty("--rx", `${state.rx.toFixed(2)}deg`);
        el.style.setProperty("--ry", `${state.ry.toFixed(2)}deg`);

        if (
          Math.abs(state.targetX - state.x) > 0.05 ||
          Math.abs(state.targetY - state.y) > 0.05 ||
          Math.abs(state.targetRx - state.rx) > 0.02 ||
          Math.abs(state.targetRy - state.ry) > 0.02
        ) {
          stillAnimating = true;
        }
      }

      if (stillAnimating) {
        rafId = window.requestAnimationFrame(animate);
      } else {
        rafId = null;
      }
    };

    const ensureAnimationLoop = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    for (const el of targets) {
      states.set(el, {
        x: 50,
        y: 50,
        rx: 0,
        ry: 0,
        targetX: 50,
        targetY: 50,
        targetRx: 0,
        targetRy: 0
      });
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.addEventListener("pointermove", onMove, { passive: true });
      el.addEventListener("pointermove", ensureAnimationLoop, { passive: true });
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointerleave", ensureAnimationLoop);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      for (const el of targets) {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointermove", ensureAnimationLoop);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("pointerleave", ensureAnimationLoop);
      }
    };
  }, [user]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    try {
      const fn = authMode === "signup" ? signup : login;
      const payload =
        authMode === "signup"
          ? { ...authForm, role: authRole }
          : { email: authForm.email, password: authForm.password };

      const authResult = await fn(payload);

      if (authMode === "login" && authResult?.user?.role && authResult.user.role !== authRole) {
        await logout();
        throw new Error(
          `This account is ${ROLE_LABELS[authResult.user.role]}. Use the ${ROLE_LABELS[authResult.user.role]} login section.`
        );
      }

      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Authentication failed");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (_error) {
      // No-op, keep UX consistent even if logout endpoint already expired.
    }
    setUser(null);
    await loadData({ silent: true });
  }

  async function onCreateCampaign(event) {
    event.preventDefault();
    try {
      await createCampaign({
        title: campaignForm.title,
        budget: Number(campaignForm.budget),
        description: campaignForm.description
      });
      setCampaignForm(initialCampaign);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to create campaign");
    }
  }

  async function onInviteInfluencer(event) {
    event.preventDefault();
    try {
      await createMatch({
        campaignId: Number(matchForm.campaignId),
        influencerId: Number(matchForm.influencerId)
      });
      setMatchForm(initialMatch);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to create match");
    }
  }

  async function onCreateProposal(event) {
    event.preventDefault();
    try {
      await createProposal({
        matchId: Number(proposalForm.matchId),
        deliverables: proposalForm.deliverables,
        amount: Number(proposalForm.amount)
      });
      setProposalForm(initialProposal);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to create proposal");
    }
  }

  async function onStatus(id, status) {
    try {
      await updateProposalStatus(id, status);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to update status");
    }
  }

  async function onCloseCampaign(id) {
    try {
      await closeCampaign(id);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to close campaign");
    }
  }

  return (
    <main className="app-shell" data-role-theme={roleTheme} aria-busy={isLoading || isRefreshing}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Influencer x Brand OS</p>
            <h1>Collaboration Command Center</h1>
            <p className="hero-sub">Professional workspace for campaign execution, matchmaking, and proposals.</p>
          </div>
        </div>

        {user ? (
          <div className="topbar-user">
            <p>
              {user.name} <span className="role-pill">{user.role}</span>
            </p>
            <span className={`sync-pill ${isRefreshing ? "is-active" : ""}`}>{isRefreshing ? "Syncing..." : "Live"}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="error-banner" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}

      {isLoading && !user ? (
        <section className="auth-card" id="main-content" tabIndex={-1}>
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" />
            <p>Preparing {roleLabel} workspace...</p>
          </div>
        </section>
      ) : !user ? (
        <section className="auth-card" id="main-content" tabIndex={-1}>
          <div className="auth-role-switch">
            <button
              type="button"
              className={`btn btn-segment ${authRole === "BRAND" ? "active" : ""}`}
              onClick={() => setAuthRole("BRAND")}
            >
              Brand Section
            </button>
            <button
              type="button"
              className={`btn btn-segment ${authRole === "INFLUENCER" ? "active" : ""}`}
              onClick={() => setAuthRole("INFLUENCER")}
            >
              Influencer Section
            </button>
          </div>

          <div className="auth-mode">
            <button
              type="button"
              className={`btn btn-segment ${authMode === "login" ? "active" : ""}`}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`btn btn-segment ${authMode === "signup" ? "active" : ""}`}
              onClick={() => setAuthMode("signup")}
            >
              Signup
            </button>
          </div>
          <p className="auth-note">
            {authMode === "login"
              ? `Sign in using your ${ROLE_LABELS[authRole]} account.`
              : `Create a new ${ROLE_LABELS[authRole]} account.`}
          </p>
          {authMode === "login" && authRole === "BRAND" ? (
            <p className="form-hint">Brand email: brand.demo@collab.local | Password: Password123!</p>
          ) : null}

          <form className="form" onSubmit={handleAuthSubmit}>
            {authMode === "signup" ? (
              <>
                <label className="sr-only" htmlFor="auth-name">
                  Full name
                </label>
                <input
                  id="auth-name"
                  placeholder="Full name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  autoComplete="name"
                  required
                />
              </>
            ) : null}

            <label className="sr-only" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              autoComplete="email"
              required
            />
            <label className="sr-only" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              required
            />
            <button type="submit" className="btn btn-primary">
              {authMode === "signup" ? `Create ${ROLE_LABELS[authRole]} account` : `Sign in as ${ROLE_LABELS[authRole]}`}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="control-panel" id="main-content" tabIndex={-1}>
            <div className="search-wrap">
              <input
                ref={searchRef}
                placeholder="Search campaigns, matches, proposals... (Press /)"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="control-actions">
              <select value={campaignStatusFilter} onChange={(event) => setCampaignStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select value={campaignSort} onChange={(event) => setCampaignSort(event.target.value)}>
                <option value="NEWEST">Sort: Newest</option>
                <option value="BUDGET_HIGH">Sort: Budget High-Low</option>
                <option value="BUDGET_LOW">Sort: Budget Low-High</option>
                <option value="TITLE">Sort: Title A-Z</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => loadData({ silent: true })}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
              <label className="toggle-wrap">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                Auto refresh
              </label>
            </div>
            <p className="meta-line">
              Last sync: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Waiting..."} | Campaigns: {filteredCampaigns.length}
            </p>
          </section>

          <section className="stats-grid">
            {stats.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} />
            ))}
          </section>

          <section className="workspace-grid">
            {isBrand ? (
              <article className="panel">
                <h2>Launch Campaign</h2>
                <p className="panel-subtitle">Publish briefs with budget and goals for influencer discovery.</p>
                <form className="form" onSubmit={onCreateCampaign}>
                  <label className="sr-only" htmlFor="campaign-title">
                    Campaign title
                  </label>
                  <input
                    id="campaign-title"
                    placeholder="Campaign title"
                    value={campaignForm.title}
                    onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })}
                    required
                  />
                  <label className="sr-only" htmlFor="campaign-budget">
                    Budget
                  </label>
                  <input
                    id="campaign-budget"
                    type="number"
                    placeholder="Budget"
                    value={campaignForm.budget}
                    onChange={(event) => setCampaignForm({ ...campaignForm, budget: event.target.value })}
                    min="1"
                    step="1"
                    required
                  />
                  <label className="sr-only" htmlFor="campaign-description">
                    Campaign brief
                  </label>
                  <textarea
                    id="campaign-description"
                    placeholder="Campaign brief"
                    value={campaignForm.description}
                    onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })}
                  />
                  <button type="submit" className="btn btn-primary">
                    Create Campaign
                  </button>
                </form>
              </article>
            ) : null}

            {isBrand ? (
              <article className="panel">
                <h2>Invite Influencer</h2>
                <p className="panel-subtitle">Create direct matches from your active campaign pipeline.</p>
                <form className="form" onSubmit={onInviteInfluencer}>
                  <label className="sr-only" htmlFor="match-campaign">
                    Select campaign
                  </label>
                  <select
                    id="match-campaign"
                    value={matchForm.campaignId}
                    onChange={(event) => setMatchForm({ ...matchForm, campaignId: event.target.value })}
                    required
                  >
                    <option value="">Select campaign</option>
                    {myCampaigns
                      .filter((campaign) => campaign.status === "OPEN")
                      .map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          #{campaign.id} {campaign.title}
                        </option>
                      ))}
                  </select>
                  <label className="sr-only" htmlFor="match-influencer">
                    Select influencer
                  </label>
                  <select
                    id="match-influencer"
                    value={matchForm.influencerId}
                    onChange={(event) => setMatchForm({ ...matchForm, influencerId: event.target.value })}
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((influencer) => (
                      <option key={influencer.id} value={influencer.id}>
                        #{influencer.id} {influencer.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary">
                    Create Match
                  </button>
                </form>
              </article>
            ) : (
              <article className="panel">
                <h2>Submit Proposal</h2>
                <p className="panel-subtitle">Draft deliverables and pricing for your active matches.</p>
                <form className="form" onSubmit={onCreateProposal}>
                  <label className="sr-only" htmlFor="proposal-match">
                    Select match
                  </label>
                  <select
                    id="proposal-match"
                    value={proposalForm.matchId}
                    onChange={(event) => setProposalForm({ ...proposalForm, matchId: event.target.value })}
                    required
                    disabled={!hasMatches}
                  >
                    <option value="">{hasMatches ? "Select match" : "No matches available"}</option>
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        #{match.id} - {match.campaign.title}
                      </option>
                    ))}
                  </select>
                  {!hasMatches ? (
                    <p id="proposal-match-hint" className="form-hint">
                      No active matches yet. Ask a brand to create a match first.
                    </p>
                  ) : null}
                  <label className="sr-only" htmlFor="proposal-deliverables">
                    Deliverables
                  </label>
                  <input
                    id="proposal-deliverables"
                    placeholder="Deliverables"
                    value={proposalForm.deliverables}
                    onChange={(event) => setProposalForm({ ...proposalForm, deliverables: event.target.value })}
                    required
                  />
                  <label className="sr-only" htmlFor="proposal-amount">
                    Amount
                  </label>
                  <input
                    id="proposal-amount"
                    type="number"
                    placeholder="Amount"
                    value={proposalForm.amount}
                    onChange={(event) => setProposalForm({ ...proposalForm, amount: event.target.value })}
                    min="1"
                    step="1"
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={!hasMatches}>
                    Send Proposal Draft
                  </button>
                </form>
              </article>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Campaign Feed</h2>
              <p className="meta-line">{filteredCampaigns.length} items</p>
            </div>
            <ul className="item-list">
              {filteredCampaigns.map((campaign) => (
                <li key={campaign.id}>
                  <div>
                    <strong>{campaign.title}</strong>
                    <p>{formatMoney(campaign.budget)}</p>
                  </div>
                  <div className="list-tail">
                    <StatusChip value={campaign.status} />
                    {isBrand && campaign.brandId === user.id && campaign.status === "OPEN" ? (
                      <button type="button" className="btn btn-ghost" onClick={() => onCloseCampaign(campaign.id)}>
                        Close Campaign
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {!filteredCampaigns.length ? <p className="list-empty">No campaigns match the current filters.</p> : null}
          </section>

          <section className="split-grid">
            <article className="panel">
              <div className="panel-head">
                <h2>Matches</h2>
                <p className="meta-line">{filteredMatches.length} items</p>
              </div>
              <ul className="item-list compact">
                {filteredMatches.map((match) => (
                  <li key={match.id}>
                    <div>
                      <strong>Match #{match.id}</strong>
                      <p>{match.campaign.title}</p>
                    </div>
                    <StatusChip value={match.status || "PENDING"} />
                  </li>
                ))}
              </ul>
              {!filteredMatches.length ? <p className="list-empty">No matches found for this search.</p> : null}
            </article>

            <article className="panel">
              <div className="panel-head">
                <h2>Proposals</h2>
                <p className="meta-line">Accepted: {acceptanceRate}%</p>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${acceptanceRate}%` }} />
              </div>
              <ul className="item-list compact">
                {filteredProposals.map((proposal) => (
                  <li key={proposal.id}>
                    <div>
                      <strong>
                        #{proposal.id} {proposal.deliverables}
                      </strong>
                      <p>{formatMoney(proposal.amount)}</p>
                    </div>
                    <div className="row-actions">
                      <StatusChip value={proposal.status} />
                      <button type="button" className="btn btn-secondary" onClick={() => onStatus(proposal.id, "SENT")}>
                        Send
                      </button>
                      <button type="button" className="btn btn-success" onClick={() => onStatus(proposal.id, "ACCEPTED")}>
                        Accept
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => onStatus(proposal.id, "REJECTED")}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!filteredProposals.length ? <p className="list-empty">No proposals found for this search.</p> : null}
            </article>
          </section>
        </>
      )}
    </main>
  );
}


