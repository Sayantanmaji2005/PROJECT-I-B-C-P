import { useEffect, useMemo, useState } from "react";
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

function Stat({ label, value }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
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

  const isBrand = user?.role === "BRAND";

  const stats = useMemo(
    () => [
      { label: "Live Campaigns", value: campaigns.filter((c) => c.status === "OPEN").length },
      { label: "Your Matches", value: matches.length },
      { label: "Proposals", value: proposals.length },
      { label: "Influencers", value: influencers.length }
    ],
    [campaigns, matches, proposals, influencers]
  );

  async function loadData() {
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
    } catch (err) {
      setError(err.message || "Failed to load data");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    try {
      const fn = authMode === "signup" ? signup : login;
      const payload = authMode === "signup" ? authForm : { email: authForm.email, password: authForm.password };
      await fn(payload);
      await loadData();
    } catch (err) {
      setError(err.message || "Authentication failed");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (_error) {
      // ignore and proceed to refresh UI state
    }
    setUser(null);
    await loadData();
  }

  async function onCreateCampaign(e) {
    e.preventDefault();
    try {
      await createCampaign({
        title: campaignForm.title,
        budget: Number(campaignForm.budget),
        description: campaignForm.description
      });
      setCampaignForm(initialCampaign);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create campaign");
    }
  }

  async function onInviteInfluencer(e) {
    e.preventDefault();
    try {
      await createMatch({
        campaignId: Number(matchForm.campaignId),
        influencerId: Number(matchForm.influencerId)
      });
      setMatchForm(initialMatch);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create match");
    }
  }

  async function onCreateProposal(e) {
    e.preventDefault();
    try {
      await createProposal({
        matchId: Number(proposalForm.matchId),
        deliverables: proposalForm.deliverables,
        amount: Number(proposalForm.amount)
      });
      setProposalForm(initialProposal);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to create proposal");
    }
  }

  async function onStatus(id, status) {
    try {
      await updateProposalStatus(id, status);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update status");
    }
  }

  async function onCloseCampaign(id) {
    try {
      await closeCampaign(id);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to close campaign");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Influencer x Brand OS</p>
          <h1>Collaboration Command Center</h1>
        </div>
        {user ? (
          <div className="topbar-user">
            <p>
              {user.name} <span>{user.role}</span>
            </p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : null}
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {!user ? (
        <section className="auth-card">
          <div className="auth-mode">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Login</button>
            <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Signup</button>
          </div>
          <form className="form" onSubmit={handleAuthSubmit}>
            {authMode === "signup" ? (
              <>
                <input
                  placeholder="Full name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  required
                />
                <select value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}>
                  <option value="BRAND">Brand</option>
                  <option value="INFLUENCER">Influencer</option>
                </select>
              </>
            ) : null}
            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              required
            />
            <button type="submit">{authMode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            {stats.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} />
            ))}
          </section>

          <section className="workspace-grid">
            {isBrand ? (
              <article className="panel">
                <h2>Launch Campaign</h2>
                <form className="form" onSubmit={onCreateCampaign}>
                  <input
                    placeholder="Campaign title"
                    value={campaignForm.title}
                    onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Budget"
                    value={campaignForm.budget}
                    onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })}
                    required
                  />
                  <textarea
                    placeholder="Campaign brief"
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  />
                  <button type="submit">Create Campaign</button>
                </form>
              </article>
            ) : null}

            {isBrand ? (
              <article className="panel">
                <h2>Invite Influencer</h2>
                <form className="form" onSubmit={onInviteInfluencer}>
                  <select
                    value={matchForm.campaignId}
                    onChange={(e) => setMatchForm({ ...matchForm, campaignId: e.target.value })}
                    required
                  >
                    <option value="">Select campaign</option>
                    {myCampaigns.filter((c) => c.status === "OPEN").map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        #{campaign.id} {campaign.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={matchForm.influencerId}
                    onChange={(e) => setMatchForm({ ...matchForm, influencerId: e.target.value })}
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((inf) => (
                      <option key={inf.id} value={inf.id}>
                        #{inf.id} {inf.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Create Match</button>
                </form>
              </article>
            ) : (
              <article className="panel">
                <h2>Submit Proposal</h2>
                <form className="form" onSubmit={onCreateProposal}>
                  <select
                    value={proposalForm.matchId}
                    onChange={(e) => setProposalForm({ ...proposalForm, matchId: e.target.value })}
                    required
                  >
                    <option value="">Select match</option>
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        #{match.id} - {match.campaign.title}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Deliverables"
                    value={proposalForm.deliverables}
                    onChange={(e) => setProposalForm({ ...proposalForm, deliverables: e.target.value })}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={proposalForm.amount}
                    onChange={(e) => setProposalForm({ ...proposalForm, amount: e.target.value })}
                    required
                  />
                  <button type="submit">Send Proposal Draft</button>
                </form>
              </article>
            )}
          </section>

          <section className="panel">
            <h2>Campaign Feed</h2>
            <ul className="item-list">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <div>
                    <strong>{campaign.title}</strong>
                    <p>${campaign.budget.toLocaleString()} • {campaign.status}</p>
                  </div>
                  {isBrand && campaign.brandId === user.id && campaign.status === "OPEN" ? (
                    <button onClick={() => onCloseCampaign(campaign.id)}>Close Campaign</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="split-grid">
            <article className="panel">
              <h2>Matches</h2>
              <ul className="item-list compact">
                {matches.map((match) => (
                  <li key={match.id}>
                    <div>
                      <strong>Match #{match.id}</strong>
                      <p>{match.campaign.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h2>Proposals</h2>
              <ul className="item-list compact">
                {proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <div>
                      <strong>#{proposal.id} {proposal.deliverables}</strong>
                      <p>${proposal.amount} • {proposal.status}</p>
                    </div>
                    <div className="row-actions">
                      <button onClick={() => onStatus(proposal.id, "SENT")}>Send</button>
                      <button onClick={() => onStatus(proposal.id, "ACCEPTED")}>Accept</button>
                      <button onClick={() => onStatus(proposal.id, "REJECTED")}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
