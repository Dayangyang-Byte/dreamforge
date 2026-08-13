import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, ChevronDown, Download, FileClock, KeyRound, MessageSquareWarning, RefreshCcw, Search, Shield, Ticket, UserRound, WalletCards } from "lucide-react";
import "./admin.css";

const apiBase = import.meta.env.VITE_API_BASE || "";
const adminTokenKey = "dreamforge_admin_token";

export function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(adminTokenKey) || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [codes, setCodes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [failures, setFailures] = useState([]);
  const [generationRequests, setGenerationRequests] = useState([]);
  const [rechargeOrders, setRechargeOrders] = useState([]);
  const [apiChannels, setApiChannels] = useState([]);
  const [apiEffective, setApiEffective] = useState([]);
  const [apiSaving, setApiSaving] = useState(false);
  const [apiTesting, setApiTesting] = useState({});
  const [announcement, setAnnouncement] = useState({
    enabled: false,
    title: "网站公告",
    content: "",
    buttonLabel: "我知道了",
    titleEn: "Site Update",
    contentEn: "",
    buttonLabelEn: "Got it",
    version: "1"
  });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [assetEdits, setAssetEdits] = useState({});
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", credits: 20, note: "" });
  const [rechargeEdits, setRechargeEdits] = useState({});
  const [rechargeConfirming, setRechargeConfirming] = useState({});
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [liveExpanded, setLiveExpanded] = useState(false);
  const [referenceCache, setReferenceCache] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);
  const [codeFilterAccount, setCodeFilterAccount] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [creditTraceAccount, setCreditTraceAccount] = useState("");
  const [creditTraceSearch, setCreditTraceSearch] = useState("");
  const [creditTrace, setCreditTrace] = useState(null);
  const [creditTraceLoading, setCreditTraceLoading] = useState(false);
  const [creditAdjustment, setCreditAdjustment] = useState({ targetCredits: "", note: "" });
  const [creditAdjustmentSaving, setCreditAdjustmentSaving] = useState(false);

  useEffect(() => {
    if (token) refreshAll(token);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    if (tab === "api" || tab === "announcement") return undefined;
    const timer = window.setInterval(() => {
      refreshAll(token, { silent: true });
    }, tab === "history" ? 5000 : 15000);
    return () => window.clearInterval(timer);
  }, [token, tab]);

  const visibleHistory = useMemo(() => history.slice(0, 100), [history]);
  const visibleGenerationRequests = useMemo(() => generationRequests.slice(0, 40), [generationRequests]);
  const liveItems = useMemo(
    () => (liveExpanded ? visibleGenerationRequests : visibleGenerationRequests.slice(0, 5)),
    [liveExpanded, visibleGenerationRequests]
  );
  const accountOptions = useMemo(() => users.map((user) => user.account).filter(Boolean), [users]);
  const filteredCodes = useMemo(() => {
    const keyword = codeSearch.trim().toLowerCase();
    return codes.filter((item) => {
      if (codeFilterAccount && item.usedBy !== codeFilterAccount) return false;
      if (!keyword) return true;
      return [item.code, item.usedBy, item.note]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [codes, codeFilterAccount, codeSearch]);

  useEffect(() => {
    if (!token || tab !== "creditTrace" || creditTraceAccount || !accountOptions.length) return;
    const account = accountOptions[0];
    setCreditTraceAccount(account);
    setCreditTraceSearch(account);
    loadCreditTrace(account);
  }, [token, tab, creditTraceAccount, accountOptions]);

  function togglePrompt(id) {
    setExpandedPrompts((current) => ({ ...current, [id]: !current[id] }));
  }

  async function adminFetch(path, options = {}, authToken = token) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "请求失败");
    return data;
  }

  async function login(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      localStorage.setItem(adminTokenKey, data.token);
      setToken(data.token);
      await refreshAll(data.token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshAll(authToken = token, options = {}) {
    if (!authToken) return;
    if (!options.silent) setLoading(true);
    setError("");
    try {
      const [overviewData, usersData, historyData, codesData, requestsData, rechargeData, apiData, announcementData] = await Promise.all([
        adminFetch("/api/admin/overview", {}, authToken),
        adminFetch("/api/admin/users", {}, authToken),
        adminFetch("/api/admin/history", {}, authToken),
        adminFetch("/api/admin/redeem-codes", {}, authToken),
        adminFetch("/api/admin/generation-requests", {}, authToken),
        adminFetch("/api/admin/recharge-orders", {}, authToken),
        adminFetch("/api/admin/api-channels", {}, authToken),
        adminFetch("/api/admin/announcement", {}, authToken)
      ]);
      setOverview(overviewData.stats);
      setUsers(usersData.users || []);
      setHistory(historyData.history || []);
      setCodes(codesData.codes || []);
      setGenerationRequests(requestsData.requests || []);
      setRechargeOrders(rechargeData.orders || []);
      setApiChannels(apiData.channels || []);
      setApiEffective(apiData.effective || []);
      setAnnouncement(announcementData.announcement || announcement);
      if (!options.silent || tab === "logs" || tab === "reports" || tab === "failures") {
        const [logsData, reportsData, failuresData] = await Promise.all([
          adminFetch("/api/admin/logs", {}, authToken),
          adminFetch("/api/admin/reports", {}, authToken),
          adminFetch("/api/admin/failures", {}, authToken)
        ]);
        setLogs(logsData.logs || []);
        setReports(reportsData.reports || []);
        setFailures(failuresData.failures || []);
      }
    } catch (err) {
      setError(err.message);
      if (/登录|权限/.test(err.message)) {
        localStorage.removeItem(adminTokenKey);
        setToken("");
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  async function createRedeemCode(event) {
    event.preventDefault();
    setError("");
    try {
      await adminFetch("/api/admin/redeem-codes", {
        method: "POST",
        body: JSON.stringify(newCode)
      });
      setNewCode({ code: "", credits: 20, note: "" });
      await refreshAll();
      setTab("codes");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadCreditTrace(account = creditTraceAccount, authToken = token) {
    const target = String(account || "").trim();
    if (!target) {
      setCreditTrace(null);
      return;
    }
    setError("");
    setCreditTraceLoading(true);
    try {
      const data = await adminFetch(`/api/admin/credit-trace?account=${encodeURIComponent(target)}`, {}, authToken);
      setCreditTrace(data);
      setCreditAdjustment((current) => ({
        ...current,
        targetCredits: String(data.summary?.currentCredits ?? "")
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCreditTraceLoading(false);
    }
  }

  function selectCreditTraceAccount(account) {
    const target = String(account || "").trim();
    if (!target) return;
    setCreditTraceSearch(target);
    setCreditTraceAccount(target);
    loadCreditTrace(target);
  }

  function searchCreditTraceAccount() {
    const keyword = creditTraceSearch.trim().toLowerCase();
    if (!keyword) {
      setError("请输入用户账号后再查询");
      return;
    }
    const exact = accountOptions.find((account) => account.toLowerCase() === keyword);
    const matches = accountOptions.filter((account) => account.toLowerCase().includes(keyword));
    if (exact) {
      selectCreditTraceAccount(exact);
      return;
    }
    if (matches.length === 1) {
      selectCreditTraceAccount(matches[0]);
      return;
    }
    setError(matches.length ? `找到 ${matches.length} 个账号，请从搜索结果中选择` : "没有找到对应用户账号");
  }

  async function adjustUserCredits() {
    const account = String(creditTraceAccount || "").trim();
    const currentCredits = Number(creditTrace?.summary?.currentCredits || 0);
    const targetCredits = Math.floor(Number(creditAdjustment.targetCredits));
    const note = String(creditAdjustment.note || "").trim();
    if (!account) {
      setError("请先查询需要调整积分的用户");
      return;
    }
    if (!Number.isInteger(targetCredits) || targetCredits < 0) {
      setError("目标积分必须是大于或等于 0 的整数");
      return;
    }
    if (note.length < 2) {
      setError("请填写调整原因，方便后续追溯");
      return;
    }
    if (targetCredits === currentCredits) {
      setError("目标积分与当前余额相同，无需调整");
      return;
    }
    const delta = targetCredits - currentCredits;
    const action = delta > 0 ? `增加 ${delta}` : `扣减 ${Math.abs(delta)}`;
    if (!window.confirm(`确认将 ${account} 的剩余积分从 ${currentCredits} 调整为 ${targetCredits}（${action}）？此操作会写入积分账本。`)) {
      return;
    }

    setError("");
    setCreditAdjustmentSaving(true);
    try {
      const data = await adminFetch(`/api/admin/users/${encodeURIComponent(account)}/credits`, {
        method: "POST",
        body: JSON.stringify({ targetCredits, note })
      });
      setCreditTrace(data.trace);
      setCreditAdjustment({ targetCredits: String(data.trace?.summary?.currentCredits ?? targetCredits), note: "" });
      await refreshAll(token, { silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCreditAdjustmentSaving(false);
    }
  }

  function updateApiChannel(id, patch) {
    setApiChannels((current) => current.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel)));
  }

  async function saveApiChannels() {
    setError("");
    setApiSaving(true);
    try {
      const data = await adminFetch("/api/admin/api-channels", {
        method: "POST",
        body: JSON.stringify({ channels: apiChannels })
      });
      setApiChannels(data.channels || []);
      setApiEffective(data.effective || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setApiSaving(false);
    }
  }

  async function testApiChannel(channel) {
    setError("");
    setApiTesting((current) => ({ ...current, [channel.id]: true }));
    try {
      const data = await adminFetch(`/api/admin/api-channels/${encodeURIComponent(channel.id)}/test`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setApiChannels((current) => current.map((item) => (item.id === channel.id ? data.channel : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setApiTesting((current) => ({ ...current, [channel.id]: false }));
    }
  }

  function updateRechargeEdit(id, patch) {
    setRechargeEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), ...patch } }));
  }

  async function confirmRechargeOrder(item) {
    const edit = rechargeEdits[item.id] || {};
    const credits = Math.floor(Number(edit.credits ?? item.credits ?? 0));
    if (!credits || credits <= 0) {
      setError("确认积分必须大于 0");
      return;
    }
    setError("");
    setRechargeConfirming((current) => ({ ...current, [item.id]: true }));
    try {
      await adminFetch(`/api/admin/recharge-orders/${encodeURIComponent(item.id)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ credits, note: edit.note || "" })
      });
      setRechargeEdits((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await refreshAll(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setRechargeConfirming((current) => ({ ...current, [item.id]: false }));
    }
  }

  function updateAnnouncement(patch) {
    setAnnouncement((current) => ({ ...current, ...patch }));
  }

  async function saveAnnouncement() {
    setError("");
    setAnnouncementSaving(true);
    try {
      const data = await adminFetch("/api/admin/announcement", {
        method: "POST",
        body: JSON.stringify({
          announcement: {
            ...announcement,
            version: announcement.version || String(Date.now())
          }
        })
      });
      setAnnouncement(data.announcement || announcement);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnnouncementSaving(false);
    }
  }

  function getAssetEdit(item) {
    return {
      assetStatus: item.assetStatus || "候选",
      qualityScore: Number(item.qualityScore || 0),
      reviewNotes: item.reviewNotes || "",
      reusablePattern: item.reusablePattern || "",
      failureReason: item.failureReason || "",
      ...(assetEdits[item.id] || {})
    };
  }

  function changeAssetEdit(id, patch) {
    setAssetEdits((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch
      }
    }));
  }

  async function saveAsset(item, patch = {}) {
    setError("");
    const edit = { ...getAssetEdit(item), ...patch };
    try {
      const data = await adminFetch(`/api/admin/images/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify(edit)
      });
      setHistory((current) => current.map((entry) => (entry.id === item.id ? data.image : entry)));
      setAssetEdits((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadAdminImage(item) {
    setError("");
    const url = item.url || item.thumbnailUrl;
    if (!url) {
      setError("这张图片没有可下载地址");
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("图片下载失败");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = blob.type.includes("jpeg") || blob.type.includes("jpg")
        ? "jpg"
        : blob.type.includes("webp")
          ? "webp"
          : "png";
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${item.jobId || item.id || "dreamforge"}_${Number(item.imageIndex || 0) + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message || "图片下载失败");
    }
  }

  async function loadJobReferences(item) {
    if (!item.jobId || !item.referencesCount || referenceCache[item.jobId]?.loading || referenceCache[item.jobId]?.loaded) return;
    setReferenceCache((current) => ({
      ...current,
      [item.jobId]: { loading: true, loaded: false, references: [], error: "" }
    }));
    try {
      const data = await adminFetch(`/api/admin/jobs/${encodeURIComponent(item.jobId)}/references`);
      setReferenceCache((current) => ({
        ...current,
        [item.jobId]: { loading: false, loaded: true, references: data.references || [], error: "" }
      }));
    } catch (err) {
      setReferenceCache((current) => ({
        ...current,
        [item.jobId]: { loading: false, loaded: true, references: [], error: err.message || "参考图读取失败" }
      }));
    }
  }

  function logout() {
    localStorage.removeItem(adminTokenKey);
    setToken("");
  }

  function templateBadge(item) {
    const id = item.promptTemplate || "custom";
    if (id === "custom") return "模板：自定义";
    return `模板：${item.promptTemplateLabel || id}`;
  }

  if (!token) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={login}>
          <Shield size={30} />
          <h1>DreamForge 后台</h1>
          <p>输入管理员密码进入运营后台</p>
          <input
            value={password}
            type="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="管理员密码"
          />
          {error && <span className="admin-error">{error}</span>}
          <button type="submit">登录后台</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Shield size={24} />
          <strong>DreamForge</strong>
          <span>运营后台</span>
        </div>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>总览</button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>用户账号</button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => setTab("ledger")}>账本校验</button>
        <button className={tab === "creditTrace" ? "active" : ""} onClick={() => setTab("creditTrace")}>积分追溯</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>生成记录</button>
        <button className={tab === "api" ? "active" : ""} onClick={() => setTab("api")}>API 工作室</button>
        <button className={tab === "announcement" ? "active" : ""} onClick={() => setTab("announcement")}>公告管理</button>
        <button className={tab === "recharge" ? "active" : ""} onClick={() => setTab("recharge")}>充值订单</button>
        <button className={tab === "codes" ? "active" : ""} onClick={() => setTab("codes")}>兑换码</button>
        <button className={tab === "failures" ? "active" : ""} onClick={() => setTab("failures")}>失败记录</button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>操作日志</button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>投诉举报</button>
        <a href="/">返回网站</a>
        <button onClick={logout}>退出后台</button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>Admin Console</p>
            <h1>{tabTitle(tab)}</h1>
          </div>
          <button onClick={() => refreshAll()} disabled={loading}>
            <RefreshCcw size={16} />
            {loading ? "刷新中" : "刷新"}
          </button>
        </header>

        {error && <div className="admin-alert">{error}</div>}

        {tab === "overview" && (
          <>
            <div className="admin-stats">
              <Stat label="用户数" value={overview?.users || 0} />
              <Stat label="剩余总积分" value={overview?.totalCredits || 0} />
              <Stat label="历史任务" value={overview?.jobs || 0} />
              <Stat label="历史图片" value={overview?.images || 0} />
              <Stat label="今日任务" value={overview?.todayJobs || 0} />
              <Stat label="今日图片" value={overview?.todayImages || 0} />
              <Stat label="兑换码" value={overview?.redeemCodes || 0} />
              <Stat label="未使用兑换码" value={overview?.unusedRedeemCodes || 0} />
            </div>
            <form className="admin-create-code" onSubmit={createRedeemCode}>
              <h2>创建兑换码</h2>
              <input value={newCode.code} onChange={(event) => setNewCode((v) => ({ ...v, code: event.target.value }))} placeholder="留空自动生成，例如 VIP20-AB12" />
              <input value={newCode.credits} type="number" min="1" onChange={(event) => setNewCode((v) => ({ ...v, credits: Number(event.target.value) }))} placeholder="积分" />
              <input value={newCode.note} onChange={(event) => setNewCode((v) => ({ ...v, note: event.target.value }))} placeholder="备注" />
              <button type="submit"><Ticket size={16} />创建</button>
            </form>
          </>
        )}

        {tab === "users" && (
          <div className="admin-table-card">
            <table>
              <thead>
                <tr><th>账号</th><th>积分</th><th>生成任务数</th><th>生成图片数</th><th>消耗积分</th><th>兑换次数</th><th>注册时间</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.account}>
                    <td><UserRound size={14} />{user.account}</td>
                    <td>{user.credits}</td>
                    <td>{user.generationTaskCount ?? user.generateCount}</td>
                    <td>{user.imageCount || 0}</td>
                    <td>{user.spentCredits}</td>
                    <td>{user.redeemCount}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ledger" && (
          <>
            <div className="admin-stats ledger-stats">
              <Stat label="用户余额合计" value={overview?.ledgerAudit?.totalCredits || 0} />
              <Stat label="日志推算余额" value={overview?.ledgerAudit?.ledgerCredits || 0} />
              <Stat label="差异积分" value={overview?.ledgerAudit?.diff || 0} />
              <Stat label="差异账号" value={overview?.ledgerAudit?.mismatchCount || 0} />
              <Stat label="兑换积分" value={overview?.ledgerAudit?.redeemCredits || 0} />
              <Stat label="生成消耗" value={overview?.ledgerAudit?.generateCost || 0} />
            </div>
            <div className="admin-table-card ledger-card">
              <div className="ledger-note">
                <strong>{overview?.ledgerAudit?.diff ? "发现账本差异" : "账本一致"}</strong>
                <span>按兑换、退款、手工调整、生成扣费日志反推余额；这里只做核对，不自动改用户积分。</span>
              </div>
              <table>
                <thead>
                  <tr><th>账号</th><th>当前余额</th><th>日志余额</th><th>差异</th><th>日志数</th><th>更新时间</th></tr>
                </thead>
                <tbody>
                  {(overview?.ledgerAudit?.mismatches || []).map((item) => (
                    <tr key={item.account}>
                      <td><UserRound size={14} />{item.account}</td>
                      <td>{item.userCredits}</td>
                      <td>{item.ledgerCredits}</td>
                      <td className={item.diff ? "ledger-diff" : ""}>{item.diff}</td>
                      <td>{item.logCount}</td>
                      <td>{formatDate(item.updatedAt)}</td>
                    </tr>
                  ))}
                  {!(overview?.ledgerAudit?.mismatches || []).length && (
                    <tr><td colSpan="6">暂无差异账号</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "creditTrace" && (
          <div className="credit-trace-page">
            <section className="credit-trace-selector">
              <div>
                <strong>按用户追溯积分来源</strong>
                <span>选择账号后，可以同时查看兑换码、网站充值和完整积分流水。</span>
              </div>
              <AccountSearch
                value={creditTraceSearch}
                options={accountOptions}
                placeholder="搜索用户账号，例如 244252881@qq.com"
                onChange={setCreditTraceSearch}
                onSelect={selectCreditTraceAccount}
              />
              <button type="button" onClick={searchCreditTraceAccount} disabled={creditTraceLoading}>
                <Search size={15} />
                查询用户
              </button>
              {creditTraceAccount && (
                <button type="button" onClick={() => loadCreditTrace()} disabled={creditTraceLoading}>
                  <RefreshCcw size={15} className={creditTraceLoading ? "spin" : ""} />
                  刷新追溯
                </button>
              )}
            </section>

            {creditTrace?.summary ? (
              <>
                <div className="admin-stats credit-trace-stats">
                  <Stat label="当前余额" value={creditTrace.summary.currentCredits || 0} />
                  <Stat label="流水推算余额" value={creditTrace.summary.ledgerCredits || 0} />
                  <Stat label="账本差异" value={creditTrace.summary.diff || 0} />
                  <Stat label="兑换码入账" value={creditTrace.summary.redeemCredits || 0} />
                  <Stat label="网站充值入账" value={creditTrace.summary.rechargeCredits || 0} />
                  <Stat label="生成消耗" value={creditTrace.summary.generateCost || 0} />
                </div>

                <section className="credit-adjustment-card">
                  <div className="credit-adjustment-heading">
                    <span className="credit-adjustment-icon"><WalletCards size={18} /></span>
                    <div>
                      <strong>人工调整余额</strong>
                      <span>设置该用户调整后的剩余积分，系统会自动计算加减额并写入积分流水。</span>
                    </div>
                  </div>
                  <label>
                    <span>目标剩余积分</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={creditAdjustment.targetCredits}
                      disabled={creditTraceLoading || creditAdjustmentSaving}
                      onChange={(event) => setCreditAdjustment((current) => ({ ...current, targetCredits: event.target.value }))}
                    />
                  </label>
                  <label className="credit-adjustment-note">
                    <span>调整原因</span>
                    <input
                      value={creditAdjustment.note}
                      disabled={creditTraceLoading || creditAdjustmentSaving}
                      onChange={(event) => setCreditAdjustment((current) => ({ ...current, note: event.target.value }))}
                      placeholder="例如：补偿一次生成失败"
                    />
                  </label>
                  <button
                    type="button"
                    className="credit-adjustment-submit"
                    onClick={adjustUserCredits}
                    disabled={creditTraceLoading || creditAdjustmentSaving}
                  >
                    {creditTraceLoading ? "正在加载" : creditAdjustmentSaving ? "正在调整" : "确认调整"}
                  </button>
                </section>

                <section className="admin-table-card trace-table-card">
                  <div className="trace-table-head">
                    <strong>兑换码记录</strong>
                    <span>{creditTrace.redeemCodes?.length || 0} 条</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>兑换码</th><th>积分</th><th>使用时间</th><th>备注</th></tr>
                    </thead>
                    <tbody>
                      {(creditTrace.redeemCodes || []).map((item) => (
                        <tr key={item.code}>
                          <td><KeyRound size={14} />{item.code}</td>
                          <td>{item.credits}</td>
                          <td>{formatDate(item.usedAt) || "-"}</td>
                          <td>{item.note || "-"}</td>
                        </tr>
                      ))}
                      {!(creditTrace.redeemCodes || []).length && (
                        <tr><td colSpan="4">这个用户暂时没有兑换码记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>

                <section className="admin-table-card trace-table-card">
                  <div className="trace-table-head">
                    <strong>网站充值记录</strong>
                    <span>{creditTrace.rechargeOrders?.length || 0} 条，待确认 {creditTrace.summary.pendingRechargeCount || 0} 条</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>创建时间</th><th>渠道</th><th>金额</th><th>积分</th><th>状态</th><th>到账时间</th><th>订单号</th></tr>
                    </thead>
                    <tbody>
                      {(creditTrace.rechargeOrders || []).map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{rechargeProviderLabel(item.provider)}</td>
                          <td>{item.amountYuan} 元</td>
                          <td>{item.credits}</td>
                          <td>{rechargeStatusLabel(item.status)}</td>
                          <td>{formatDate(item.paidAt) || "-"}</td>
                          <td>{item.outTradeNo || "-"}</td>
                        </tr>
                      ))}
                      {!(creditTrace.rechargeOrders || []).length && (
                        <tr><td colSpan="7">这个用户暂时没有网站充值记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>

                <section className="admin-table-card trace-table-card">
                  <div className="trace-table-head">
                    <strong>积分流水</strong>
                    <span>最近 {creditTrace.creditLogs?.length || 0} 条</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>时间</th><th>类型</th><th>变动</th><th>关联编号</th><th>模型/渠道</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                      {(creditTrace.creditLogs || []).map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{creditLogTypeLabel(item.type)}</td>
                          <td className={item.type === "generate" ? "trace-cost" : "trace-income"}>{creditLogDelta(item)}</td>
                          <td>{item.code || "-"}</td>
                          <td>{[item.model, item.quality].filter(Boolean).join(" / ") || "-"}</td>
                          <td className="trace-prompt-cell" title={item.prompt || ""}>{item.prompt || "-"}</td>
                        </tr>
                      ))}
                      {!(creditTrace.creditLogs || []).length && (
                        <tr><td colSpan="6">这个用户暂时没有积分流水</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </>
            ) : (
              <div className="admin-table-card trace-empty-state">请选择一个用户账号开始追溯。</div>
            )}
          </div>
        )}

        {tab === "history" && (
          <>
            <section className="admin-live-panel">
              <div className="admin-section-head">
                <div>
                  <h2>实时生成动态</h2>
                  <p>用户提交后会先出现在这里，完成后再进入下面的图片历史。</p>
                </div>
                <span>{liveExpanded ? visibleGenerationRequests.length : Math.min(5, visibleGenerationRequests.length)} / {visibleGenerationRequests.length} 条</span>
              </div>
              <div className="admin-live-list">
                {liveItems.map((item) => (
                  <article className={`admin-live-item ${item.status}`} key={item.id}>
                    <strong>{item.account || "-"}</strong>
                    <span className="model-chip">{modelBadge(item)}</span>
                    <span>{statusLabel(item.status)} · {stageLabel(item.stage)}</span>
                    <ChannelAttemptSummary attempts={item.channelAttempts} />
                    <span>{formatDate(item.startedAt)} 提交{item.completedAt ? ` · ${formatDuration(item.startedAt, item.completedAt)}` : ""}</span>
                    <PromptPreview prompt={item.prompt} expanded={Boolean(expandedPrompts[item.id])} onToggle={() => togglePrompt(item.id)} />
                  </article>
                ))}
              </div>
              {visibleGenerationRequests.length > 5 && (
                <button type="button" className="admin-live-toggle" onClick={() => setLiveExpanded((value) => !value)}>
                  <ChevronDown className={liveExpanded ? "expanded" : ""} size={16} />
                  {liveExpanded ? "收起较早动态" : `展开另外 ${visibleGenerationRequests.length - 5} 条`}
                </button>
              )}
            </section>

            <div className="admin-history-grid">
              {visibleHistory.map((item) => (
                <article className="admin-history-card" key={item.id}>
                  <button
                    type="button"
                    className="admin-image-peek"
                    onMouseEnter={() => setHoverPreview({ url: item.url || item.thumbnailUrl, title: `${item.account} 生成图` })}
                    onMouseLeave={() => setHoverPreview(null)}
                    onFocus={() => setHoverPreview({ url: item.url || item.thumbnailUrl, title: `${item.account} 生成图` })}
                    onBlur={() => setHoverPreview(null)}
                  >
                    <img src={item.thumbnailUrl || item.url} alt="生成记录图片" loading="lazy" />
                    <span>悬停看大图</span>
                  </button>
                  <div>
                    <strong>{item.account}</strong>
                    <span className="model-chip">{modelBadge(item)}</span>
                    <span className={item.promptTemplate && item.promptTemplate !== "custom" ? "template-chip selected" : "template-chip"}>
                      {templateBadge(item)}
                    </span>
                    <span>{formatDate(item.createdAt)} · {item.ratio || "-"} · {item.referencesCount || 0} 张参考图</span>
                    <ReferenceStrip
                      item={item}
                      state={referenceCache[item.jobId]}
                      onLoad={() => loadJobReferences(item)}
                      onPreview={setHoverPreview}
                    />
                    <PromptPreview prompt={item.prompt} expanded={Boolean(expandedPrompts[item.id])} onToggle={() => togglePrompt(item.id)} />
                    <div className="asset-meta">
                      <small title={item.referencePlan?.error || ""}>{referencePlanLabel(item.referencePlan)}</small>
                    </div>
                    <div className="asset-status-row">
                      {["候选", "可用", "精选", "失败"].map((status) => (
                        <button
                          type="button"
                          key={status}
                          className={(assetEdits[item.id]?.assetStatus || item.assetStatus) === status ? "active" : ""}
                          onClick={() => saveAsset(item, { assetStatus: status })}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <div className="asset-review">
                      <select
                        value={getAssetEdit(item).qualityScore}
                        onChange={(event) => changeAssetEdit(item.id, { qualityScore: Number(event.target.value) })}
                      >
                        {Array.from({ length: 11 }).map((_, score) => (
                          <option value={score} key={score}>{score} 分</option>
                        ))}
                      </select>
                      <input
                        value={getAssetEdit(item).reviewNotes}
                        onChange={(event) => changeAssetEdit(item.id, { reviewNotes: event.target.value })}
                        placeholder="质检备注"
                      />
                      <input
                        value={getAssetEdit(item).reusablePattern}
                        onChange={(event) => changeAssetEdit(item.id, { reusablePattern: event.target.value })}
                        placeholder="可复用模式"
                      />
                      <input
                        value={getAssetEdit(item).failureReason}
                        onChange={(event) => changeAssetEdit(item.id, { failureReason: event.target.value })}
                        placeholder="失败原因"
                      />
                      <button type="button" onClick={() => saveAsset(item)}>保存复盘</button>
                    </div>
                  </div>
                  <button type="button" className="admin-download-button" onClick={() => downloadAdminImage(item)}>
                    <Download size={15} />下载
                  </button>
                </article>
              ))}
            </div>
            {hoverPreview?.url && <HoverImagePreview preview={hoverPreview} />}
          </>
        )}

        {tab === "api" && (
          <ApiStudio
            channels={apiChannels}
            effective={apiEffective}
            saving={apiSaving}
            testing={apiTesting}
            onChange={updateApiChannel}
            onSave={saveApiChannels}
            onTest={testApiChannel}
          />
        )}

        {tab === "announcement" && (
          <AnnouncementPanel
            announcement={announcement}
            saving={announcementSaving}
            onChange={updateAnnouncement}
            onSave={saveAnnouncement}
          />
        )}

        {tab === "recharge" && (
          <div className="admin-table-card">
            <table>
              <thead>
                <tr><th>时间</th><th>账号</th><th>渠道</th><th>金额</th><th>订单积分</th><th>确认积分</th><th>备注</th><th>状态</th><th>订单号</th><th>操作</th></tr>
              </thead>
              <tbody>
                {rechargeOrders.map((item) => {
                  const edit = rechargeEdits[item.id] || {};
                  const canConfirm = ["created", "pending"].includes(item.status);
                  return (
                    <tr key={item.id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.account || "-"}</td>
                      <td>{rechargeProviderLabel(item.provider)}</td>
                      <td>{item.amountYuan} 元</td>
                      <td>{item.credits}</td>
                      <td>
                        {canConfirm ? (
                          <input
                            className="recharge-credit-input"
                            type="number"
                            min="1"
                            value={edit.credits ?? item.credits}
                            onChange={(event) => updateRechargeEdit(item.id, { credits: event.target.value })}
                          />
                        ) : (
                          item.credits
                        )}
                      </td>
                      <td>
                        {canConfirm ? (
                          <input
                            className="recharge-note-input"
                            value={edit.note || ""}
                            onChange={(event) => updateRechargeEdit(item.id, { note: event.target.value })}
                            placeholder="可填赠送说明"
                          />
                        ) : (
                          item.transactionId || "-"
                        )}
                      </td>
                      <td>{rechargeStatusLabel(item.status)}</td>
                      <td>{item.outTradeNo || "-"}</td>
                      <td>
                        {canConfirm ? (
                          <button
                            type="button"
                            className="recharge-confirm-button"
                            onClick={() => confirmRechargeOrder(item)}
                            disabled={Boolean(rechargeConfirming[item.id])}
                          >
                            {rechargeConfirming[item.id] ? "确认中" : "确认到账"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rechargeOrders.length && (
                  <tr><td colSpan="10">暂无充值订单</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "codes" && (
          <div className="codes-page">
            <section className="code-filter-bar">
              <div>
                <strong>兑换码定位</strong>
                <span>{codeFilterAccount ? `正在查看 ${codeFilterAccount} 使用过的兑换码` : "默认显示全部兑换码，可按用户账号过滤"}</span>
              </div>
              <AccountDropdown
                value={codeFilterAccount}
                options={accountOptions}
                allLabel="全部用户"
                onChange={setCodeFilterAccount}
              />
              <label className="code-search-field">
                <Search size={16} />
                <input
                  type="search"
                  value={codeSearch}
                  onChange={(event) => setCodeSearch(event.target.value)}
                  placeholder="搜索账号、兑换码或备注"
                />
              </label>
              {codeFilterAccount && <button type="button" onClick={() => setCodeFilterAccount("")}>清空筛选</button>}
            </section>

            <div className="admin-table-card">
              <table>
                <thead>
                  <tr><th>兑换码</th><th>积分</th><th>状态</th><th>使用账号</th><th>使用时间</th><th>备注</th><th>用户情况</th></tr>
                </thead>
                <tbody>
                  {filteredCodes.map((item) => (
                    <tr key={item.code}>
                      <td>
                        <KeyRound size={14} />
                        <span>{item.code}</span>
                        <strong className="credit-badge">{item.credits}</strong>
                      </td>
                      <td>{item.credits}</td>
                      <td>{item.usedBy ? "已使用" : "未使用"}</td>
                      <td>{item.usedBy || "-"}</td>
                      <td>{formatDate(item.usedAt) || "-"}</td>
                      <td>{item.note || "-"}</td>
                      <td>
                        {item.usedBy ? (
                          <button
                            type="button"
                            className="code-trace-button"
                            onClick={() => {
                              setTab("creditTrace");
                              selectCreditTraceAccount(item.usedBy);
                            }}
                          >
                            <UserRound size={14} />
                            查看追溯
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredCodes.length && (
                    <tr><td colSpan="7">没有找到对应兑换码</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "failures" && (
          <div className="admin-table-card">
            <table>
              <thead>
                <tr><th>时间</th><th>账号</th><th>模型</th><th>阶段</th><th>比例</th><th>参考图</th><th>预计扣分</th><th>错误</th></tr>
              </thead>
              <tbody>
                {failures.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.account || "-"}</td>
                    <td>{item.model || "-"}{item.quality ? ` / ${item.quality}` : ""}</td>
                    <td>{item.stage || "-"}</td>
                    <td>{item.ratio || "-"}</td>
                    <td>{item.referencesCount || 0}</td>
                    <td>{item.cost || 0}</td>
                    <td>{item.error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "logs" && (
          <div className="admin-table-card">
            <table>
              <thead>
                <tr><th>时间</th><th>账号</th><th>操作</th><th>路径</th><th>状态</th><th>IP</th><th>浏览器</th></tr>
              </thead>
              <tbody>
                {logs.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><FileClock size={14} />{item.account || "-"}</td>
                    <td>{item.action}</td>
                    <td>{item.path}</td>
                    <td>{item.status}</td>
                    <td>{item.ip || "-"}</td>
                    <td>{item.userAgent || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "reports" && (
          <div className="admin-table-card">
            <table>
              <thead>
                <tr><th>时间</th><th>类型</th><th>联系方式</th><th>内容</th><th>状态</th><th>IP</th></tr>
              </thead>
              <tbody>
                {reports.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><MessageSquareWarning size={14} />{item.type}</td>
                    <td>{item.contact || "-"}</td>
                    <td>{item.content}</td>
                    <td>{item.status}</td>
                    <td>{item.ip || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function PromptPreview({ prompt, expanded, onToggle }) {
  const text = prompt || "无提示词";
  const canToggle = text.length > 80;
  return (
    <div className={expanded ? "prompt-preview expanded" : "prompt-preview"} title={text}>
      <p>{text}</p>
      {canToggle && (
        <button type="button" onClick={onToggle}>
          {expanded ? "收起完整提示词" : "展开完整提示词"}
        </button>
      )}
    </div>
  );
}

function AccountDropdown({ value, options = [], placeholder = "选择账号", allLabel = "", onChange }) {
  const [open, setOpen] = useState(false);
  const items = allLabel
    ? [{ value: "", label: allLabel }, ...options.map((account) => ({ value: account, label: account }))]
    : options.map((account) => ({ value: account, label: account }));
  const label = value || allLabel || placeholder;

  return (
    <div
      className={open ? "account-picker open" : "account-picker"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className="account-picker-trigger" onClick={() => setOpen((current) => !current)}>
        <span>{label}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="account-picker-menu" role="listbox">
          {items.length ? (
            items.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={item.value === value ? "active" : ""}
                key={item.value || "__all"}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))
          ) : (
            <span className="account-picker-empty">暂无用户账号</span>
          )}
        </div>
      )}
    </div>
  );
}

function AccountSearch({ value, options = [], placeholder = "搜索用户账号", onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const keyword = String(value || "").trim().toLowerCase();
  const matches = options
    .filter((account) => !keyword || account.toLowerCase().includes(keyword))
    .slice(0, 12);

  function select(account) {
    onSelect(account);
    setOpen(false);
  }

  return (
    <div
      className="account-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search size={17} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (matches.length === 1) select(matches[0]);
        }}
      />
      {open && (
        <div className="account-search-menu" role="listbox">
          {matches.length ? (
            matches.map((account) => (
              <button
                type="button"
                role="option"
                key={account}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(account)}
              >
                {account}
              </button>
            ))
          ) : (
            <span>没有匹配账号</span>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelAttemptSummary({ attempts }) {
  const list = Array.isArray(attempts) ? attempts : [];
  if (!list.length) return <span className="channel-attempt-chip muted">通道：-</span>;

  const last = list[list.length - 1];
  const usedFallback = list.some((item) => item.role && item.role !== "primary");
  const failedBeforeSuccess = list.some((item) => item.status === "failed") && last.status === "success";
  const statusClass = last.status === "success" ? "ok" : last.status === "failed" ? "bad" : "running";
  const summary = failedBeforeSuccess
    ? `通道：主失败 → ${channelRoleLabel(last.role)}成功`
    : usedFallback
      ? `通道：${channelRoleLabel(last.role)}${channelStatusLabel(last.status)}`
      : `通道：主${channelStatusLabel(last.status)}`;
  const detail = list
    .map((item, index) => {
      const duration = item.durationMs ? `${Math.round(item.durationMs / 1000)}秒` : "";
      const retry = item.status === "failed" ? `，${item.retryable ? "已允许兜底" : "未触发兜底"}` : "";
      const error = item.error ? `，${item.error}` : "";
      return `${index + 1}. ${channelRoleLabel(item.role)} / ${item.model || "-"} / ${item.apiBase || "-"}：${channelStatusLabel(item.status)}${duration ? `，${duration}` : ""}${item.statusCode ? `，HTTP ${item.statusCode}` : ""}${retry}${error}`;
    })
    .join("\n");

  return <span className={`channel-attempt-chip ${statusClass}`} title={detail}>{summary}</span>;
}

function channelRoleLabel(role) {
  return { primary: "主", fallback: "备用", fallback1: "备用1", fallback2: "备用2" }[role] || role || "-";
}

function channelStatusLabel(status) {
  return { running: "请求中", success: "成功", failed: "失败" }[status] || status || "-";
}

function AnnouncementPanel({ announcement, saving, onChange, onSave }) {
  const content = announcement.content || "";
  const contentEn = announcement.contentEn || "";
  return (
    <div className="announcement-studio">
      <div className="admin-section-head">
        <div>
          <h2>公告管理</h2>
          <p>启用后，用户进入网站会看到公告；同一版本点过确认后不会重复弹出。</p>
        </div>
        <button type="button" className="api-save-button" onClick={onSave} disabled={saving}>
          {saving ? "保存中" : "保存公告"}
        </button>
      </div>

      <section className="announcement-editor-card">
        <div className="announcement-form">
          <label className="announcement-switch">
            <input
              type="checkbox"
              checked={Boolean(announcement.enabled)}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            <span>启用公告弹窗</span>
          </label>
          <label>
            <span>公告标题</span>
            <input
              value={announcement.title || ""}
              maxLength={80}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="例如：网站公告"
            />
          </label>
          <label>
            <span>公告内容</span>
            <textarea
              value={content}
              maxLength={3000}
              onChange={(event) => onChange({ content: event.target.value })}
              placeholder="在这里填写用户进入网站后需要看到的公告内容。"
            />
            <small>{content.length} / 3000</small>
          </label>
          <label>
            <span>English title</span>
            <input
              value={announcement.titleEn || ""}
              maxLength={80}
              onChange={(event) => onChange({ titleEn: event.target.value })}
              placeholder="Optional English title"
            />
          </label>
          <label>
            <span>English content</span>
            <textarea
              value={contentEn}
              maxLength={3000}
              onChange={(event) => onChange({ contentEn: event.target.value })}
              placeholder="Optional English announcement content"
            />
            <small>{contentEn.length} / 3000</small>
          </label>
          <div className="announcement-inline-fields">
            <label>
              <span>按钮文案</span>
              <input
                value={announcement.buttonLabel || ""}
                maxLength={20}
                onChange={(event) => onChange({ buttonLabel: event.target.value })}
                placeholder="我知道了"
              />
            </label>
            <label>
              <span>English button</span>
              <input
                value={announcement.buttonLabelEn || ""}
                maxLength={20}
                onChange={(event) => onChange({ buttonLabelEn: event.target.value })}
                placeholder="Got it"
              />
            </label>
            <label>
              <span>版本号</span>
              <input
                value={announcement.version || ""}
                maxLength={40}
                onChange={(event) => onChange({ version: event.target.value })}
                placeholder="例如：2026-07-24"
              />
            </label>
            <button type="button" onClick={() => onChange({ version: String(Date.now()) })}>
              更新版本
            </button>
          </div>
        </div>

        <div className="announcement-preview-card">
          <span className="announcement-preview-kicker"><Bell size={14} /> 弹窗预览</span>
          <strong>{announcement.title || "网站公告"}</strong>
          <p>{content || "公告内容会显示在这里。"}</p>
          <button type="button">{announcement.buttonLabel || "我知道了"}</button>
          {contentEn ? (
            <div className="announcement-preview-secondary">
              <strong>{announcement.titleEn || "Site Update"}</strong>
              <p>{contentEn}</p>
              <button type="button">{announcement.buttonLabelEn || "Got it"}</button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ApiStudio({ channels, effective, saving, testing, onChange, onSave, onTest }) {
  const groups = [
    {
      provider: "gpt-image-2",
      title: "GPT Image 2",
      tiers: [
        { id: "1k", label: "1K" },
        { id: "2k", label: "2K" },
        { id: "4k", label: "4K" }
      ]
    }
  ];
  return (
    <div className="api-studio">
      <div className="admin-section-head">
        <div>
          <h2>API 工作室</h2>
          <p>后台启用的通道优先于 .env；某个档位没有启用通道时，自动回落到 .env 兜底配置。</p>
        </div>
        <button type="button" className="api-save-button" onClick={onSave} disabled={saving}>
          {saving ? "保存中" : "保存配置"}
        </button>
      </div>

      {groups.map((group) => (
        <section className="api-provider-group" key={group.provider}>
          <h3>{group.title}</h3>
          {group.tiers.map((tier) => {
            const tierChannels = channels.filter((channel) => channel.provider === group.provider && channel.tier === tier.id);
            const status = effective.find((item) => item.provider === group.provider && item.tier === tier.id);
            return (
              <section className="api-tier-card" key={`${group.provider}_${tier.id}`}>
                <div className="api-tier-head">
                  <div>
                    <strong>{group.title} {tier.label}</strong>
                    <span>当前生效：{status?.source === "api-studio" ? `后台 API 工作室（${status.activeCount} 个启用通道）` : ".env 兜底"}</span>
                  </div>
                  <small>
                    ENV 主：{status?.envPrimary?.configured ? `${status.envPrimary.apiBase} / ${status.envPrimary.model}` : "未配置"}
                  </small>
                </div>

                <div className="api-channel-list">
                  {tierChannels.map((channel) => (
                    <article className={channel.enabled ? "api-channel-card enabled" : "api-channel-card"} key={channel.id}>
                      <div className="api-channel-title">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(channel.enabled)}
                            onChange={(event) => onChange(channel.id, { enabled: event.target.checked })}
                          />
                          <span>{apiRoleLabel(channel.role)}</span>
                        </label>
                        <em>{channel.apiKeySet ? `Key：${channel.apiKeyMasked}` : "未设置 Key"}</em>
                      </div>

                      <div className="api-channel-grid">
                        <label>
                          <span>通道名称</span>
                          <input value={channel.name || ""} onChange={(event) => onChange(channel.id, { name: event.target.value })} />
                        </label>
                        <label>
                          <span>API 地址</span>
                          <input
                            value={channel.apiBase || ""}
                            onChange={(event) => onChange(channel.id, { apiBase: event.target.value })}
                            placeholder="https://example.com/v1"
                          />
                        </label>
                        <label>
                          <span>模型名</span>
                          <input
                            value={channel.model || ""}
                            onChange={(event) => onChange(channel.id, { model: event.target.value })}
                            placeholder="gpt-image-2"
                          />
                        </label>
                        <label>
                          <span>返回格式</span>
                          <select
                            value={channel.responseFormat || "b64_json"}
                            onChange={(event) => onChange(channel.id, { responseFormat: event.target.value })}
                          >
                            <option value="b64_json">b64_json</option>
                            <option value="url">url</option>
                          </select>
                        </label>
                        <label>
                          <span>替换 API Key</span>
                          <input
                            value={channel.apiKey || ""}
                            onChange={(event) => onChange(channel.id, { apiKey: event.target.value })}
                            placeholder={channel.apiKeySet ? "留空则保留现有 Key" : "请输入 API Key"}
                            autoComplete="off"
                          />
                        </label>
                        <label>
                          <span>备注</span>
                          <input value={channel.note || ""} onChange={(event) => onChange(channel.id, { note: event.target.value })} />
                        </label>
                      </div>

                      <div className="api-channel-actions">
                        <button type="button" onClick={() => onTest(channel)} disabled={Boolean(testing[channel.id]) || (!channel.apiKeySet && !channel.apiKey)}>
                          {testing[channel.id] ? "测试中" : "测试连接"}
                        </button>
                        <span className={channel.lastTestStatus === "ok" ? "api-test-ok" : channel.lastTestStatus ? "api-test-bad" : ""}>
                          {channel.lastTestStatus ? `${apiTestLabel(channel.lastTestStatus)}：${channel.lastTestMessage || "-"}` : "尚未测试"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function apiRoleLabel(role) {
  return { primary: "主 API", fallback1: "备用 API 1", fallback2: "备用 API 2" }[role] || role;
}

function apiTestLabel(status) {
  return { ok: "可用", failed: "失败", timeout: "超时", "model-missing": "模型未匹配" }[status] || status;
}

function ReferenceStrip({ item, state, onLoad, onPreview }) {
  if (!item.referencesCount) return null;
  const references = state?.references || [];
  return (
    <div className="admin-reference-strip" onMouseEnter={onLoad}>
      <div className="admin-reference-head">
        <span>参考图 {item.referencesCount} 张</span>
        {!state?.loaded && <button type="button" onClick={onLoad}>{state?.loading ? "加载中" : "查看"}</button>}
      </div>
      {state?.error ? <small>{state.error}</small> : null}
      {state?.loaded && !references.length && !state?.error ? <small>旧记录未保存参考图</small> : null}
      {references.length > 0 && (
        <div className="admin-reference-thumbs">
          {references.map((ref, index) => (
            <button
              type="button"
              key={`${ref.id || ref.name}_${index}`}
              onMouseEnter={() => onPreview({ url: ref.url, title: ref.usage || ref.name || `参考图 ${index + 1}` })}
              onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview({ url: ref.url, title: ref.usage || ref.name || `参考图 ${index + 1}` })}
              onBlur={() => onPreview(null)}
              title={ref.usage || ref.name || `参考图 ${index + 1}`}
            >
              <img src={ref.url} alt={ref.usage || ref.name || `参考图 ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HoverImagePreview({ preview }) {
  return (
    <aside className="admin-hover-preview">
      <img src={preview.url} alt={preview.title || "预览图"} />
      {preview.title ? <span>{preview.title}</span> : null}
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function tabTitle(tab) {
  const map = {
    overview: "运营总览",
    users: "用户账号",
    ledger: "账本校验",
    creditTrace: "积分追溯",
    history: "生成记录",
    api: "API 工作室",
    announcement: "公告管理",
    recharge: "充值订单",
    codes: "兑换码",
    failures: "失败记录",
    logs: "操作日志",
    reports: "投诉举报"
  };
  return map[tab] || "运营后台";
}

function creditLogTypeLabel(type) {
  const map = {
    redeem: "兑换码入账",
    recharge: "网站充值",
    generate: "生成扣费",
    refund: "失败退回",
    manual: "手工调整"
  };
  return map[type] || type || "-";
}

function creditLogDelta(item) {
  if (item.type === "generate") return `-${Number(item.cost || 0)}`;
  const value = Number(item.credits || 0);
  return value > 0 ? `+${value}` : String(value || 0);
}

function rechargeStatusLabel(status) {
  const map = {
    created: "已创建",
    pending: "待确认到账",
    paid: "已到账",
    failed: "失败/关闭",
    amount_mismatch: "金额异常"
  };
  return map[status] || status || "-";
}

function rechargeProviderLabel(provider) {
  const map = {
    wechat: "微信支付",
    wechat_manual: "微信人工收款",
    alipay: "支付宝"
  };
  return map[provider] || provider || "-";
}

function modelBadge(item) {
  const model = item.modelLabel || item.model || "未知模型";
  const quality = item.quality ? ` / ${String(item.quality).toUpperCase()}` : "";
  const cost = Number(item.cost || item.creditCost || 0);
  const imageCount = Number(item.jobImageCount || item.count || 0);
  if (cost && imageCount > 1) {
    const prefix = item.jobImageCount ? "本任务" : "";
    return `${model}${quality} · ${prefix}${imageCount}张共${cost}积分`;
  }
  if (cost && imageCount === 1) return `${model}${quality} · 1张 · ${cost}积分`;
  return `${model}${quality}${cost ? ` · ${cost}积分` : ""}`;
}

function statusLabel(status) {
  const map = {
    pending: "生成中",
    success: "已完成",
    failed: "失败"
  };
  return map[status] || status || "-";
}

function stageLabel(stage) {
  const map = {
    submitted: "已提交",
    reference_analysis: "参考图分析",
    designer_brain: "设计师大脑",
    prompt_build: "提示词整理",
    upstream_generation: "上游生图",
    settlement: "积分结算",
    save_record: "保存记录",
    completed: "已入库",
    safety_check: "安全检查",
    credit_check: "积分检查"
  };
  return map[stage] || stage || "-";
}

function referencePlanLabel(plan) {
  if (!plan?.source) return "无参考图分析";
  if (plan.source === "prompt-only") {
    const reason = shortVisionError(plan.error);
    return reason ? `参考图分析：备用提示词模式 · ${reason}` : "参考图分析：备用提示词模式";
  }
  const source = plan.source.includes("agnes") ? "Agnes备用视觉" : plan.source.includes("gpt-5.5") ? "GPT5.5视觉" : plan.source;
  const usedFallback = Array.isArray(plan.attempts) && plan.attempts.some((item) => item.ok === false);
  return `参考图分析：已完成 · ${source}${usedFallback ? " · 主模型失败后切换" : ""}`;
}

function shortVisionError(error) {
  const text = String(error || "");
  if (!text) return "";
  if (/timeout/i.test(text)) return "视觉模型超时";
  if (/api key|unauthorized|401|invalid key/i.test(text)) return "视觉API配置异常";
  if (/429|rate limit|too many/i.test(text)) return "视觉模型限流";
  if (/quota|balance|insufficient/i.test(text)) return "视觉模型额度不足";
  if (/503|502|500|upstream/i.test(text)) return "视觉上游异常";
  if (/No usable reference/i.test(text)) return "参考图未成功传入";
  return text.slice(0, 80);
}

function formatDuration(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!startTime || !endTime || Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return "";
  const seconds = Math.round((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
