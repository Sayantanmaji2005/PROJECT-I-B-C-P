import { useEffect, useMemo, useRef, useState } from "react";
import {
  closeCampaign,
  createNotificationsEventSource,
  createApplication,
  createCampaign,
  createMatch,
  createMediaAsset,
  createProposal,
  createTransaction,
  fetchAdminAuditLogs,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchApplications,
  fetchBrandAnalytics,
  fetchCampaigns,
  fetchInfluencers,
  fetchInfluencerAnalytics,
  fetchMatchRecommendations,
  fetchMatches,
  fetchMediaAssets,
  fetchMyCampaigns,
  fetchMyProfile,
  fetchRecentNotifications,
  fetchProposals,
  fetchTransactions,
  fetchTransactionReceipt,
  login,
  logout,
  refundTransaction,
  releaseTransaction,
  runAdminFraudScan,
  me,
  signup,
  updateApplicationStatus,
  updateAdminFraudFlag,
  updateInfluencerProfile,
  updateProposalStatus
} from "./api";

const initialAuth = { name: "", email: "", password: "", role: "BRAND" };
const initialCampaign = {
  title: "",
  budget: "",
  description: "",
  targetAudience: "",
  targetNiche: "",
  startDate: "",
  endDate: "",
  deliverables: "",
  objective: ""
};
const initialMatch = { campaignId: "", influencerId: "" };
const initialProposal = { matchId: "", deliverables: "", amount: "" };
const initialApplication = { campaignId: "", proposalMessage: "" };
const initialTransaction = { campaignId: "", influencerId: "", proposalId: "", amount: "" };
const initialMediaAsset = { url: "", publicId: "", resourceType: "image", campaignId: "" };
const initialProfile = {
  niche: "",
  followers: "",
  engagementRate: "",
  portfolioUrl: "",
  socialLinksText: "",
  followerQualityScore: ""
};
const ROLE_LABELS = { BRAND: "Brand", INFLUENCER: "Influencer", ADMIN: "Admin" };

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
  const [applicationForm, setApplicationForm] = useState(initialApplication);
  const [transactionForm, setTransactionForm] = useState(initialTransaction);
  const [profileForm, setProfileForm] = useState(initialProfile);
  const [mediaForm, setMediaForm] = useState(initialMediaAsset);

  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [matches, setMatches] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [brandAnalytics, setBrandAnalytics] = useState(null);
  const [influencerAnalytics, setInfluencerAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminUserRoleFilter, setAdminUserRoleFilter] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("ALL");
  const [campaignSort, setCampaignSort] = useState("NEWEST");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recommendationCampaignId, setRecommendationCampaignId] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const isBrand = user?.role === "BRAND";
  const isInfluencer = user?.role === "INFLUENCER";
  const isAdmin = user?.role === "ADMIN";
  const hasMatches = matches.length > 0;
  const roleTheme = (user?.role || authRole).toLowerCase();

  const normalizedQuery = query.trim().toLowerCase();
  const roleLabel = user ? ROLE_LABELS[user.role] : ROLE_LABELS[authRole];

  const acceptanceRate = useMemo(() => {
    if (!proposals.length) return 0;
    const accepted = proposals.filter((proposal) => proposal.status === "ACCEPTED").length;
    return Math.round((accepted / proposals.length) * 100);
  }, [proposals]);

  const escrowHeldCount = useMemo(
    () => transactions.filter((transaction) => transaction.status === "HELD").length,
    [transactions]
  );

  const stats = useMemo(
    () => [
      { label: "Live Campaigns", value: campaigns.filter((campaign) => campaign.status === "OPEN").length },
      { label: "Your Matches", value: matches.length },
      { label: "Applications", value: applications.length },
      { label: "Escrow Held", value: escrowHeldCount }
    ],
    [campaigns, matches, applications, escrowHeldCount]
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

  const filteredApplications = useMemo(() => {
    if (!normalizedQuery) return applications;
    return applications.filter((application) => {
      const haystack =
        `${application.id} ${application.status} ${application.campaign?.title || ""} ${application.proposalMessage || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [applications, normalizedQuery]);

  const filteredTransactions = useMemo(() => {
    if (!normalizedQuery) return transactions;
    return transactions.filter((transaction) => {
      const haystack =
        `${transaction.id} ${transaction.status} ${transaction.campaign?.title || ""} ${transaction.influencer?.name || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [transactions, normalizedQuery]);

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
        setApplications([]);
        setTransactions([]);
        setProfile(null);
        setBrandAnalytics(null);
        setInfluencerAnalytics(null);
        setNotifications([]);
        setAdminOverview(null);
        setAdminUsers([]);
        setAdminAuditLogs([]);
        setSelectedReceipt(null);
        setMediaAssets([]);
        setMyCampaigns([]);
        setInfluencers([]);
        setError("");
        setLastUpdated(new Date());
        return;
      }

      const baseRequests = [
        fetchMatches(),
        fetchProposals(),
        fetchApplications(),
        fetchTransactions(),
        fetchMyProfile(),
        fetchRecentNotifications(),
        fetchMediaAssets()
      ];
      const brandRequests = meData.role === "BRAND" ? [fetchMyCampaigns(), fetchInfluencers()] : [];
      const analyticsRequests = meData.role === "BRAND" ? [fetchBrandAnalytics()] : meData.role === "INFLUENCER" ? [fetchInfluencerAnalytics()] : [];
      const adminRequests = meData.role === "ADMIN"
        ? [fetchAdminOverview(), fetchAdminUsers(adminUserRoleFilter), fetchAdminAuditLogs(50)]
        : [];
      const data = await Promise.all([...baseRequests, ...brandRequests, ...analyticsRequests, ...adminRequests]);

      setMatches(data[0]);
      setProposals(data[1]);
      setApplications(data[2]);
      setTransactions(data[3]);
      setProfile(data[4]);
      setNotifications(data[5]);
      setMediaAssets(data[6]);

      if (meData.role === "INFLUENCER" && data[4]) {
        setProfileForm({
          niche: data[4].niche || "",
          followers: data[4].followers ?? "",
          engagementRate: data[4].engagementRate ?? "",
          portfolioUrl: data[4].portfolioUrl || "",
          socialLinksText: Array.isArray(data[4].socialLinks) ? data[4].socialLinks.join("\n") : "",
          followerQualityScore: data[4].followerQualityScore ?? ""
        });
      }

      if (meData.role === "BRAND") {
        setMyCampaigns(data[7]);
        setInfluencers(data[8]);
        setBrandAnalytics(data[9]);
        setInfluencerAnalytics(null);
        setAdminOverview(null);
        setAdminUsers([]);
        setAdminAuditLogs([]);
        const openCampaign = data[7].find((campaign) => campaign.status === "OPEN");
        if (openCampaign && !recommendationCampaignId) {
          setRecommendationCampaignId(String(openCampaign.id));
        }
      } else if (meData.role === "INFLUENCER") {
        setMyCampaigns([]);
        setInfluencers([]);
        setBrandAnalytics(null);
        setInfluencerAnalytics(data[7]);
        setAdminOverview(null);
        setAdminUsers([]);
        setAdminAuditLogs([]);
        setRecommendationCampaignId("");
        setRecommendations([]);
      } else {
        setMyCampaigns([]);
        setInfluencers([]);
        setBrandAnalytics(null);
        setInfluencerAnalytics(null);
        setAdminOverview(data[7]);
        setAdminUsers(data[8]);
        setAdminAuditLogs(data[9]);
        setRecommendationCampaignId("");
        setRecommendations([]);
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
    }, 45000);
    return () => clearInterval(timer);
  }, [user, autoRefresh]);

  useEffect(() => {
    if (!user) return undefined;

    const source = createNotificationsEventSource((payload) => {
      if (!payload || payload.type === "heartbeat" || payload.type === "connected") return;
      setNotifications((previous) => [payload, ...previous].slice(0, 30));
    });

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [user]);

  useEffect(() => {
    if (!isBrand || !recommendationCampaignId) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;

    async function loadRecommendations() {
      setIsLoadingRecommendations(true);
      try {
        const response = await fetchMatchRecommendations(recommendationCampaignId);
        if (!cancelled) {
          setRecommendations(response.items || []);
        }
      } catch (_error) {
        if (!cancelled) {
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecommendations(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [isBrand, recommendationCampaignId, lastUpdated]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData({ silent: true });
  }, [adminUserRoleFilter]);

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

  // Disabled expensive pointer-motion effect for smoother runtime performance.

  async function handleAuthSubmit(event) {
    event.preventDefault();
    try {
      if (authMode === "signup" && authRole === "ADMIN") {
        throw new Error("Admin signup is disabled");
      }
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
        description: campaignForm.description,
        targetAudience: campaignForm.targetAudience || undefined,
        targetNiche: campaignForm.targetNiche || undefined,
        startDate: campaignForm.startDate || undefined,
        endDate: campaignForm.endDate || undefined,
        deliverables: campaignForm.deliverables || undefined,
        objective: campaignForm.objective || undefined
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

  function useRecommendation(item) {
    setMatchForm({
      campaignId: recommendationCampaignId || "",
      influencerId: String(item?.influencer?.id || "")
    });
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

  async function onApplyToCampaign(event) {
    event.preventDefault();
    try {
      await createApplication({
        campaignId: Number(applicationForm.campaignId),
        proposalMessage: applicationForm.proposalMessage
      });
      setApplicationForm(initialApplication);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to apply to campaign");
    }
  }

  async function onApplicationStatus(id, status) {
    try {
      await updateApplicationStatus(id, status);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to update application status");
    }
  }

  async function onProfileSave(event) {
    event.preventDefault();
    try {
      const socialLinks = profileForm.socialLinksText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);

      await updateInfluencerProfile({
        niche: profileForm.niche || undefined,
        followers: profileForm.followers === "" ? undefined : Number(profileForm.followers),
        engagementRate: profileForm.engagementRate === "" ? undefined : Number(profileForm.engagementRate),
        portfolioUrl: profileForm.portfolioUrl || undefined,
        socialLinks: socialLinks.length ? socialLinks : undefined,
        followerQualityScore: profileForm.followerQualityScore === "" ? undefined : Number(profileForm.followerQualityScore)
      });
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to update profile");
    }
  }

  async function onCreateTransaction(event) {
    event.preventDefault();
    try {
      await createTransaction({
        campaignId: Number(transactionForm.campaignId),
        influencerId: Number(transactionForm.influencerId),
        proposalId: transactionForm.proposalId ? Number(transactionForm.proposalId) : undefined,
        amount: Number(transactionForm.amount)
      });
      setTransactionForm(initialTransaction);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to create transaction");
    }
  }

  async function onReleaseTransaction(id) {
    try {
      await releaseTransaction(id);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to release transaction");
    }
  }

  async function onRefundTransaction(id) {
    try {
      await refundTransaction(id);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to refund transaction");
    }
  }

  async function onToggleFraudFlag(targetUser) {
    try {
      await updateAdminFraudFlag(targetUser.id, !targetUser.isFraudFlagged);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to update fraud flag");
    }
  }

  async function onRunFraudScan() {
    try {
      await runAdminFraudScan();
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to run fraud scan");
    }
  }

  async function onViewReceipt(transactionId) {
    try {
      const receipt = await fetchTransactionReceipt(transactionId);
      setSelectedReceipt(receipt);
    } catch (err) {
      setError(err.message || "Unable to load receipt");
    }
  }

  async function onCreateMediaAsset(event) {
    event.preventDefault();
    try {
      await createMediaAsset({
        url: mediaForm.url,
        publicId: mediaForm.publicId,
        resourceType: mediaForm.resourceType,
        campaignId: mediaForm.campaignId ? Number(mediaForm.campaignId) : undefined
      });
      setMediaForm(initialMediaAsset);
      await loadData({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to register media asset");
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
            <button
              type="button"
              className={`btn btn-segment ${authRole === "ADMIN" ? "active" : ""}`}
              onClick={() => {
                setAuthRole("ADMIN");
                setAuthMode("login");
              }}
            >
              Admin Section
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
          {authRole === "ADMIN" && authMode === "signup" ? (
            <p className="form-hint">Admin signup is disabled. Use admin login credentials.</p>
          ) : null}
          {authMode === "login" && authRole === "BRAND" ? (
            <p className="form-hint">Brand email: brand.demo@collab.local | Password: Password123!</p>
          ) : null}
          {authMode === "login" && authRole === "ADMIN" ? (
            <p className="form-hint">Admin email: admin@gmail.com | Password: admin123</p>
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
                placeholder="Search campaigns, matches, proposals, applications... (Press /)"
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

          <section className="panel">
            <div className="panel-head">
              <h2>Live Notifications</h2>
              <p className="meta-line">{notifications.length} recent</p>
            </div>
            <ul className="item-list compact">
              {notifications.slice(0, 8).map((notification) => (
                <li key={notification.id || `${notification.type}-${notification.createdAt}`}>
                  <div>
                    <strong>{notification.message || notification.type}</strong>
                    <p>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : "Now"}</p>
                  </div>
                  <StatusChip value={String(notification.type || "EVENT").toUpperCase()} />
                </li>
              ))}
            </ul>
            {!notifications.length ? <p className="list-empty">No notifications yet.</p> : null}
          </section>

          <section className="stats-grid">
            {stats.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} />
            ))}
          </section>

          {isBrand && brandAnalytics ? (
            <section className="split-grid">
              <article className="panel">
                <div className="panel-head">
                  <h2>Brand Analytics</h2>
                  <p className="meta-line">ROI + Conversion</p>
                </div>
                <ul className="item-list compact">
                  <li>
                    <div>
                      <strong>Estimated Reach</strong>
                      <p>{(brandAnalytics.metrics?.estimatedReach || 0).toLocaleString()}</p>
                    </div>
                    <StatusChip value="REACH" />
                  </li>
                  <li>
                    <div>
                      <strong>Conversion Rate</strong>
                      <p>{brandAnalytics.metrics?.conversionRate || 0}%</p>
                    </div>
                    <StatusChip value="CONVERSION" />
                  </li>
                  <li>
                    <div>
                      <strong>ROI</strong>
                      <p>{brandAnalytics.metrics?.roiPercent || 0}%</p>
                    </div>
                    <StatusChip value="ROI" />
                  </li>
                  <li>
                    <div>
                      <strong>Cost Per Engagement</strong>
                      <p>{formatMoney(brandAnalytics.metrics?.costPerEngagement || 0)}</p>
                    </div>
                    <StatusChip value="CPE" />
                  </li>
                </ul>
              </article>
              <article className="panel">
                <div className="panel-head">
                  <h2>Budget Flow</h2>
                  <p className="meta-line">{brandAnalytics.totals?.campaigns || 0} campaigns</p>
                </div>
                <ul className="item-list compact">
                  <li>
                    <div>
                      <strong>Total Budget</strong>
                      <p>{formatMoney(brandAnalytics.totals?.totalBudget || 0)}</p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <strong>Escrow Held</strong>
                      <p>{formatMoney(brandAnalytics.totals?.heldSpend || 0)}</p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <strong>Released Spend</strong>
                      <p>{formatMoney(brandAnalytics.totals?.releasedSpend || 0)}</p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <strong>Accepted Proposals</strong>
                      <p>{brandAnalytics.totals?.acceptedProposals || 0}</p>
                    </div>
                  </li>
                </ul>
              </article>
            </section>
          ) : null}

          {isInfluencer && influencerAnalytics ? (
            <section className="split-grid">
              <article className="panel">
                <div className="panel-head">
                  <h2>Influencer Analytics</h2>
                  <p className="meta-line">Earnings + Performance</p>
                </div>
                <ul className="item-list compact">
                  <li>
                    <div>
                      <strong>Released Earnings</strong>
                      <p>{formatMoney(influencerAnalytics.totals?.releasedEarnings || 0)}</p>
                    </div>
                    <StatusChip value="RELEASED" />
                  </li>
                  <li>
                    <div>
                      <strong>Pending Earnings</strong>
                      <p>{formatMoney(influencerAnalytics.totals?.pendingEarnings || 0)}</p>
                    </div>
                    <StatusChip value="HELD" />
                  </li>
                  <li>
                    <div>
                      <strong>Acceptance Rate</strong>
                      <p>{influencerAnalytics.metrics?.acceptanceRate || 0}%</p>
                    </div>
                    <StatusChip value="ACCEPTED" />
                  </li>
                  <li>
                    <div>
                      <strong>Profile Views</strong>
                      <p>{(influencerAnalytics.totals?.profileViews || 0).toLocaleString()}</p>
                    </div>
                    <StatusChip value="VIEWS" />
                  </li>
                </ul>
              </article>
            </section>
          ) : null}

          {isAdmin ? (
            <section className="split-grid">
              <article className="panel">
                <div className="panel-head">
                  <h2>Admin Overview</h2>
                  <button type="button" className="btn btn-secondary" onClick={onRunFraudScan}>
                    Run Fraud Scan
                  </button>
                </div>
                <ul className="item-list compact">
                  <li><div><strong>Users</strong><p>{adminOverview?.users || 0}</p></div></li>
                  <li><div><strong>Campaigns</strong><p>{adminOverview?.campaigns || 0}</p></div></li>
                  <li><div><strong>Applications</strong><p>{adminOverview?.applications || 0}</p></div></li>
                  <li><div><strong>Transactions</strong><p>{adminOverview?.transactions || 0}</p></div></li>
                  <li><div><strong>Proposals</strong><p>{adminOverview?.proposals || 0}</p></div></li>
                </ul>
              </article>
              <article className="panel">
                <div className="panel-head">
                  <h2>User Moderation</h2>
                  <select
                    value={adminUserRoleFilter}
                    onChange={(event) => setAdminUserRoleFilter(event.target.value)}
                    style={{ maxWidth: "180px" }}
                  >
                    <option value="">All roles</option>
                    <option value="ADMIN">Admin</option>
                    <option value="BRAND">Brand</option>
                    <option value="INFLUENCER">Influencer</option>
                  </select>
                </div>
                <ul className="item-list compact">
                  {adminUsers.slice(0, 10).map((adminUser) => (
                    <li key={adminUser.id}>
                      <div>
                        <strong>
                          #{adminUser.id} {adminUser.name}
                        </strong>
                        <p>{adminUser.email} | {adminUser.role}</p>
                      </div>
                      <div className="row-actions">
                        <StatusChip value={adminUser.isFraudFlagged ? "FLAGGED" : "CLEAR"} />
                        {adminUser.role === "INFLUENCER" ? (
                          <button
                            type="button"
                            className={adminUser.isFraudFlagged ? "btn btn-success" : "btn btn-danger"}
                            onClick={() => onToggleFraudFlag(adminUser)}
                          >
                            {adminUser.isFraudFlagged ? "Clear Flag" : "Flag Fraud"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

          {isAdmin ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Audit Logs</h2>
                <p className="meta-line">{adminAuditLogs.length} entries</p>
              </div>
              <ul className="item-list compact">
                {adminAuditLogs.slice(0, 12).map((log) => (
                  <li key={log.id}>
                    <div>
                      <strong>{log.action}</strong>
                      <p>{log.entityType} #{log.entityId || "-"} | {new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {!adminAuditLogs.length ? <p className="list-empty">No logs available.</p> : null}
            </section>
          ) : null}

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
                  <input
                    placeholder="Target audience"
                    value={campaignForm.targetAudience}
                    onChange={(event) => setCampaignForm({ ...campaignForm, targetAudience: event.target.value })}
                  />
                  <input
                    placeholder="Target niche"
                    value={campaignForm.targetNiche}
                    onChange={(event) => setCampaignForm({ ...campaignForm, targetNiche: event.target.value })}
                  />
                  <input
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })}
                  />
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })}
                  />
                  <input
                    placeholder="Deliverables"
                    value={campaignForm.deliverables}
                    onChange={(event) => setCampaignForm({ ...campaignForm, deliverables: event.target.value })}
                  />
                  <input
                    placeholder="Objective"
                    value={campaignForm.objective}
                    onChange={(event) => setCampaignForm({ ...campaignForm, objective: event.target.value })}
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

            {isBrand ? (
              <article className="panel">
                <h2>Matching Recommendations</h2>
                <p className="panel-subtitle">Ranked suggestions from engagement, relevance, and follower quality.</p>
                <div className="form">
                  <select
                    value={recommendationCampaignId}
                    onChange={(event) => setRecommendationCampaignId(event.target.value)}
                  >
                    <option value="">Select campaign</option>
                    {myCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        #{campaign.id} {campaign.title}
                      </option>
                    ))}
                  </select>
                </div>
                {isLoadingRecommendations ? <p className="list-empty">Loading recommendations...</p> : null}
                <ul className="item-list compact">
                  {recommendations.slice(0, 6).map((item) => (
                    <li key={item.influencer.id}>
                      <div>
                        <strong>
                          #{item.influencer.id} {item.influencer.name}
                        </strong>
                        <p>
                          Score {item.matchScore} | Engage {item.engagement}% | Relevance {item.relevance}% | Quality {item.followerQuality}%
                        </p>
                      </div>
                      <div className="row-actions">
                        <StatusChip value={item.alreadyMatched ? "MATCHED" : item.applicationStatus || "NEW"} />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => useRecommendation(item)}
                          disabled={item.alreadyMatched}
                        >
                          Use
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {!recommendations.length && !isLoadingRecommendations ? (
                  <p className="list-empty">No recommendations available for this campaign yet.</p>
                ) : null}
              </article>
            ) : null}

            {isInfluencer ? (
              <article className="panel">
                <h2>Apply To Campaign</h2>
                <p className="panel-subtitle">Apply directly to open campaigns with your pitch.</p>
                <form className="form" onSubmit={onApplyToCampaign}>
                  <select
                    value={applicationForm.campaignId}
                    onChange={(event) => setApplicationForm({ ...applicationForm, campaignId: event.target.value })}
                    required
                  >
                    <option value="">Select open campaign</option>
                    {campaigns.filter((campaign) => campaign.status === "OPEN").map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        #{campaign.id} {campaign.title}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Proposal message"
                    value={applicationForm.proposalMessage}
                    onChange={(event) => setApplicationForm({ ...applicationForm, proposalMessage: event.target.value })}
                  />
                  <button type="submit" className="btn btn-primary">
                    Apply
                  </button>
                </form>
              </article>
            ) : null}

            {isInfluencer ? (
              <article className="panel">
                <h2>Influencer Profile</h2>
                <p className="panel-subtitle">Keep your profile analytics updated for matching quality.</p>
                <form className="form" onSubmit={onProfileSave}>
                  <input
                    placeholder="Niche"
                    value={profileForm.niche}
                    onChange={(event) => setProfileForm({ ...profileForm, niche: event.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Followers"
                    value={profileForm.followers}
                    onChange={(event) => setProfileForm({ ...profileForm, followers: event.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Engagement Rate (%)"
                    value={profileForm.engagementRate}
                    onChange={(event) => setProfileForm({ ...profileForm, engagementRate: event.target.value })}
                  />
                  <input
                    placeholder="Portfolio URL"
                    value={profileForm.portfolioUrl}
                    onChange={(event) => setProfileForm({ ...profileForm, portfolioUrl: event.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Follower Quality Score (0-100)"
                    value={profileForm.followerQualityScore}
                    onChange={(event) => setProfileForm({ ...profileForm, followerQualityScore: event.target.value })}
                  />
                  <textarea
                    placeholder="Social links (one URL per line)"
                    value={profileForm.socialLinksText}
                    onChange={(event) => setProfileForm({ ...profileForm, socialLinksText: event.target.value })}
                  />
                  <button type="submit" className="btn btn-primary">
                    Save Profile
                  </button>
                </form>
                {profile?.isFraudFlagged ? <p className="form-hint">Fraud flag detected. Contact support/admin.</p> : null}
              </article>
            ) : null}

            {isBrand ? (
              <article className="panel">
                <h2>Escrow Transactions</h2>
                <p className="panel-subtitle">Create HELD transactions and release/refund them later.</p>
                <form className="form" onSubmit={onCreateTransaction}>
                  <select
                    value={transactionForm.campaignId}
                    onChange={(event) => setTransactionForm({ ...transactionForm, campaignId: event.target.value })}
                    required
                  >
                    <option value="">Select campaign</option>
                    {myCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        #{campaign.id} {campaign.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={transactionForm.influencerId}
                    onChange={(event) => setTransactionForm({ ...transactionForm, influencerId: event.target.value })}
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((influencer) => (
                      <option key={influencer.id} value={influencer.id}>
                        #{influencer.id} {influencer.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={transactionForm.proposalId}
                    onChange={(event) => setTransactionForm({ ...transactionForm, proposalId: event.target.value })}
                  >
                    <option value="">Optional accepted proposal</option>
                    {proposals
                      .filter((proposal) => proposal.status === "ACCEPTED")
                      .map((proposal) => (
                        <option key={proposal.id} value={proposal.id}>
                          #{proposal.id} {proposal.deliverables}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Amount"
                    value={transactionForm.amount}
                    onChange={(event) => setTransactionForm({ ...transactionForm, amount: event.target.value })}
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    Create Held Transaction
                  </button>
                </form>
              </article>
            ) : null}

            <article className="panel">
              <h2>Cloud Media Assets</h2>
              <p className="panel-subtitle">Register Cloudinary asset URLs for portfolio and campaign deliverables.</p>
              <form className="form" onSubmit={onCreateMediaAsset}>
                <input
                  placeholder="Asset URL"
                  value={mediaForm.url}
                  onChange={(event) => setMediaForm({ ...mediaForm, url: event.target.value })}
                  required
                />
                <input
                  placeholder="Cloud public_id"
                  value={mediaForm.publicId}
                  onChange={(event) => setMediaForm({ ...mediaForm, publicId: event.target.value })}
                  required
                />
                <select
                  value={mediaForm.resourceType}
                  onChange={(event) => setMediaForm({ ...mediaForm, resourceType: event.target.value })}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="raw">Raw</option>
                </select>
                <select
                  value={mediaForm.campaignId}
                  onChange={(event) => setMediaForm({ ...mediaForm, campaignId: event.target.value })}
                >
                  <option value="">Optional campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      #{campaign.id} {campaign.title}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary">
                  Register Asset
                </button>
              </form>
              <ul className="item-list compact">
                {mediaAssets.slice(0, 4).map((asset) => (
                  <li key={asset.id}>
                    <div>
                      <strong>{asset.publicId}</strong>
                      <p>{asset.resourceType} | {asset.campaign?.title || "No campaign"}</p>
                    </div>
                    <a className="btn btn-secondary" href={asset.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </article>
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

          <section className="split-grid">
            <article className="panel">
              <div className="panel-head">
                <h2>Applications</h2>
                <p className="meta-line">{filteredApplications.length} items</p>
              </div>
              <ul className="item-list compact">
                {filteredApplications.map((application) => (
                  <li key={application.id}>
                    <div>
                      <strong>
                        #{application.id} {application.campaign?.title}
                      </strong>
                      <p>{application.proposalMessage || "No message"}</p>
                    </div>
                    <div className="row-actions">
                      <StatusChip value={application.status} />
                      {isBrand ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => onApplicationStatus(application.id, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => onApplicationStatus(application.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {isInfluencer ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => onApplicationStatus(application.id, "WITHDRAWN")}
                        >
                          Withdraw
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {!filteredApplications.length ? <p className="list-empty">No applications found for this search.</p> : null}
            </article>

            <article className="panel">
              <div className="panel-head">
                <h2>Transactions</h2>
                <p className="meta-line">{filteredTransactions.length} items</p>
              </div>
              <ul className="item-list compact">
                {filteredTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <div>
                      <strong>
                        #{transaction.id} {transaction.campaign?.title}
                      </strong>
                      <p>
                        {formatMoney(transaction.amount)} | {transaction.influencer?.name}
                      </p>
                    </div>
                    <div className="row-actions">
                      <StatusChip value={transaction.status} />
                      {isBrand && transaction.status === "HELD" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => onReleaseTransaction(transaction.id)}
                          >
                            Release
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => onRefundTransaction(transaction.id)}
                          >
                            Refund
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onViewReceipt(transaction.id)}
                      >
                        Receipt
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!filteredTransactions.length ? <p className="list-empty">No transactions found for this search.</p> : null}
            </article>
          </section>

          {selectedReceipt ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Receipt</h2>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedReceipt(null)}>
                  Close
                </button>
              </div>
              <ul className="item-list compact">
                <li><div><strong>Receipt Number</strong><p>{selectedReceipt.receiptNumber}</p></div></li>
                <li><div><strong>Campaign</strong><p>#{selectedReceipt.campaign?.id} {selectedReceipt.campaign?.title}</p></div></li>
                <li><div><strong>Influencer</strong><p>{selectedReceipt.influencer?.name}</p></div></li>
                <li><div><strong>Amount</strong><p>{formatMoney(selectedReceipt.amount)}</p></div></li>
                <li><div><strong>Status</strong><p>{selectedReceipt.status}</p></div></li>
                <li><div><strong>Created At</strong><p>{new Date(selectedReceipt.createdAt).toLocaleString()}</p></div></li>
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}




