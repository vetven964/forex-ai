/* V TRADE AI — Admin Menu + All Session
   Mobile/PC safe navigation layer.
   Does NOT modify Telegram Bot.
   Put this script on the Admin Dashboard only.

   Routes can be changed in ROUTES if your existing filenames differ.
*/
(() => {
  "use strict";

  const ROUTES = {
    home: "admin-dashboard.html",
    userDashboard: "premium-dashboard.html",
    adminDashboard: "admin-dashboard.html",
    terminalLive: "premium-dashboard-live.html",
    signals: "signals.html",
    ai: "ai.html",
    profile: "profile.html"
  };

  const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "km", label: "ខ្មែរ" },
    { code: "zh", label: "中文" }
  ];

  const TEXT = {
    en: {
      home:"Home", user:"User Dashboard", admin:"Admin Dashboard",
      terminal:"Terminal Live", signals:"Signals", ai:"AI Intelligence",
      profile:"Profile", language:"Language", signout:"Sign out",
      sessions:"All Session", online:"ONLINE", offline:"OFFLINE",
      userLink:"User Dashboard", terminalLink:"Terminal Live",
      profileLink:"Profile", noSessions:"No active sessions"
    },
    km: {
      home:"ទំព័រដើម", user:"User Dashboard", admin:"Admin Dashboard",
      terminal:"Terminal Live", signals:"Signals", ai:"AI Intelligence",
      profile:"Profile", language:"ភាសា", signout:"ចាកចេញ",
      sessions:"All Session", online:"ONLINE", offline:"OFFLINE",
      userLink:"User Dashboard", terminalLink:"Terminal Live",
      profileLink:"Profile", noSessions:"មិនមាន Session សកម្ម"
    },
    zh: {
      home:"首页", user:"用户面板", admin:"管理员面板",
      terminal:"实时终端", signals:"信号", ai:"AI 智能",
      profile:"个人资料", language:"语言", signout:"退出",
      sessions:"全部会话", online:"在线", offline:"离线",
      userLink:"用户面板", terminalLink:"实时终端",
      profileLink:"个人资料", noSessions:"没有活动会话"
    }
  };

  const esc = (v) => String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  function getLang() {
    return localStorage.getItem("vtrade_language") || "en";
  }

  function setLang(code) {
    const lang = LANGUAGES.some(x => x.code === code) ? code : "en";
    localStorage.setItem("vtrade_language", lang);
    document.documentElement.lang = lang;
    renderMenu();
    renderSessions();
    window.dispatchEvent(new CustomEvent("vtrade:language", { detail:{ language:lang }}));
  }

  function getSessions() {
    if (Array.isArray(window.V_TRADE_SESSIONS)) return window.V_TRADE_SESSIONS;
    try {
      const raw = localStorage.getItem("vtrade_sessions");
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function sessionUrl(route, session) {
    const u = new URL(route, window.location.href);
    if (session?.id != null) u.searchParams.set("session", String(session.id));
    if (session?.email) u.searchParams.set("email", String(session.email));
    return u.href;
  }

  function statusClass(status) {
    const s = String(status || "").toLowerCase();
    return ["online","active","live","ready"].includes(s)
      ? "vta-online" : "vta-offline";
  }

  function navLink(key, icon) {
    const t = TEXT[getLang()];
    const labels = {
      home:t.home, user:t.user, admin:t.admin, terminal:t.terminal,
      signals:t.signals, ai:t.ai, profile:t.profile
    };
    return `<a class="vta-nav-link" href="${esc(ROUTES[key])}">
      <span class="vta-nav-icon">${icon}</span><span>${esc(labels[key])}</span>
    </a>`;
  }

  function renderMenu() {
    let root = document.querySelector("#vtrade-admin-menu");
    if (!root) {
      root = document.createElement("aside");
      root.id = "vtrade-admin-menu";
      document.body.prepend(root);
    }

    const t = TEXT[getLang()];
    root.innerHTML = `
      <div class="vta-menu-backdrop" data-vta-close></div>
      <div class="vta-menu-panel">
        <div class="vta-menu-head">
          <a class="vta-brand" href="${esc(ROUTES.home)}" aria-label="V TRADE AI Home">
            <span class="vta-logo">V</span>
            <span><strong>V TRADE AI</strong><small>Admin Menu</small></span>
          </a>
          <button class="vta-close" type="button" data-vta-close aria-label="Close">×</button>
        </div>

        <nav class="vta-nav">
          ${navLink("home","⌂")}
          ${navLink("user","♙")}
          ${navLink("admin","♛")}
          ${navLink("terminal","▣")}
          ${navLink("signals","◇")}
          ${navLink("ai","✦")}
          ${navLink("profile","◎")}
        </nav>

        <div class="vta-language">
          <label>${esc(t.language)}</label>
          <select id="vta-language-select">
            ${LANGUAGES.map(x => `<option value="${x.code}" ${x.code===getLang()?"selected":""}>${esc(x.label)}</option>`).join("")}
          </select>
        </div>

        <button class="vta-signout" type="button" id="vta-signout">↪ ${esc(t.signout)}</button>
      </div>
    `;

    root.querySelectorAll("[data-vta-close]").forEach(el =>
      el.addEventListener("click", () => root.classList.remove("open"))
    );

    root.querySelector("#vta-language-select")
      ?.addEventListener("change", e => setLang(e.target.value));

    root.querySelector("#vta-signout")
      ?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("vtrade:signout"));
        // Keep the project's existing auth logic if present.
        if (typeof window.VTradeSignOut === "function") {
          window.VTradeSignOut();
        } else {
          window.location.href = "index.html";
        }
      });
  }

  function addMenuButton() {
    if (document.querySelector("#vtrade-menu-button")) return;
    const b = document.createElement("button");
    b.id = "vtrade-menu-button";
    b.type = "button";
    b.className = "vta-menu-button";
    b.setAttribute("aria-label","Open menu");
    b.textContent = "☰";
    b.addEventListener("click", () =>
      document.querySelector("#vtrade-admin-menu")?.classList.add("open")
    );
    document.body.appendChild(b);
  }

  function renderSessions() {
    let root = document.querySelector("#admin-all-session");
    if (!root) {
      root = document.createElement("section");
      root.id = "admin-all-session";
      root.className = "vta-all-session";
      (document.querySelector("main") || document.body).appendChild(root);
    }

    const t = TEXT[getLang()];
    const sessions = getSessions();

    root.innerHTML = `
      <div class="vta-session-head">
        <div>
          <span class="vta-eyebrow">ADMIN</span>
          <h2>${esc(t.sessions)}</h2>
        </div>
        <span class="vta-count">${sessions.length}</span>
      </div>

      <div class="vta-session-list">
        ${sessions.length ? sessions.map(s => `
          <article class="vta-session-card">
            <div class="vta-session-info">
              <div class="vta-avatar">V</div>
              <div class="vta-session-main">
                <strong>${esc(s.name || s.email || "User")}</strong>
                <span>${esc(s.email || "—")}</span>
                <small>${esc(s.role || "USER")} · ${esc(s.lastActive || "—")}</small>
              </div>
              <span class="vta-status ${statusClass(s.status)}">
                ${esc(s.status || t.offline)}
              </span>
            </div>

            <div class="vta-session-links">
              <a class="vta-link" href="${esc(sessionUrl(ROUTES.userDashboard,s))}">♙ ${esc(t.userLink)}</a>
              <a class="vta-link vta-primary" href="${esc(sessionUrl(ROUTES.terminalLive,s))}">▣ ${esc(t.terminalLink)}</a>
              <a class="vta-link" href="${esc(sessionUrl(ROUTES.profile,s))}">◎ ${esc(t.profileLink)}</a>
            </div>
          </article>
        `).join("") : `<div class="vta-empty">${esc(t.noSessions)}</div>`}
      </div>
    `;
  }

  function injectStyles() {
    if (document.querySelector("#vtrade-admin-menu-styles")) return;
    const style = document.createElement("style");
    style.id = "vtrade-admin-menu-styles";
    style.textContent = `
      #vtrade-menu-button{
        position:fixed;right:16px;top:16px;z-index:10020;
        width:48px;height:48px;border:1px solid #263957;border-radius:13px;
        background:#091321;color:#fff;font-size:22px;cursor:pointer;
      }
      #vtrade-admin-menu{position:fixed;inset:0;z-index:10030;pointer-events:none}
      #vtrade-admin-menu.open{pointer-events:auto}
      .vta-menu-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62);opacity:0;transition:.2s}
      .vta-menu-panel{
        position:absolute;top:0;right:0;width:min(380px,92vw);height:100%;
        box-sizing:border-box;padding:20px;background:#050b15;color:#f5f7ff;
        border-left:1px solid #263957;transform:translateX(100%);transition:.24s;
        overflow:auto;
      }
      #vtrade-admin-menu.open .vta-menu-backdrop{opacity:1}
      #vtrade-admin-menu.open .vta-menu-panel{transform:translateX(0)}
      .vta-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .vta-brand{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none}
      .vta-logo{width:46px;height:46px;display:grid;place-items:center;border-radius:13px;
        background:linear-gradient(135deg,#5d20ef,#9b5cff);font-size:24px;font-weight:900}
      .vta-brand strong{display:block;font-size:17px}
      .vta-brand small{display:block;color:#8d9bb5;margin-top:3px}
      .vta-close{width:44px;height:44px;border:1px solid #263957;border-radius:12px;
        background:#091321;color:#fff;font-size:25px}
      .vta-nav{display:grid;gap:9px;margin-top:22px}
      .vta-nav-link{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 14px;
        border:1px solid #263957;border-radius:12px;background:#091321;color:#e9eef8;
        text-decoration:none;font-weight:750}
      .vta-nav-link:hover{border-color:#7544ff;background:#17102f}
      .vta-nav-icon{width:22px;text-align:center;color:#bda9ff}
      .vta-language{margin-top:18px;padding-top:16px;border-top:1px solid #263957}
      .vta-language label{display:block;color:#8d9bb5;font-size:12px;margin-bottom:7px}
      .vta-language select{width:100%;height:46px;border:1px solid #263957;border-radius:11px;
        background:#091321;color:#fff;padding:0 12px}
      .vta-signout{width:100%;height:46px;margin-top:14px;border:1px solid #7b2537;
        border-radius:11px;background:#2a0b15;color:#ff9aaa;font-weight:800}
      .vta-all-session{width:100%;box-sizing:border-box;margin:16px 0;padding:18px;
        border:1px solid #243452;border-radius:18px;background:#07101f;color:#f5f7ff}
      .vta-session-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
      .vta-session-head h2{margin:3px 0 0;font-size:22px}
      .vta-eyebrow{font-size:11px;letter-spacing:.14em;color:#8795b0}
      .vta-count{min-width:32px;height:32px;display:grid;place-items:center;border-radius:99px;
        background:#4f20d8;font-weight:800}
      .vta-session-list{display:grid;gap:12px}
      .vta-session-card{padding:14px;border:1px solid #263957;border-radius:15px;background:#091321}
      .vta-session-info{display:flex;align-items:center;gap:11px}
      .vta-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;
        background:linear-gradient(135deg,#5c22f1,#934fff);font-weight:900}
      .vta-session-main{min-width:0;flex:1;display:grid;gap:2px}
      .vta-session-main strong,.vta-session-main span,.vta-session-main small{
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vta-session-main span,.vta-session-main small{color:#93a1bb}
      .vta-status{font-size:10px;font-weight:900;padding:5px 8px;border-radius:99px}
      .vta-online{color:#54e89a;border:1px solid #176f4a;background:#062c1e}
      .vta-offline{color:#f2c94c;border:1px solid #705b16;background:#2b2508}
      .vta-session-links{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
      .vta-link{min-height:42px;display:flex;align-items:center;justify-content:center;text-align:center;
        padding:8px;border:1px solid #263957;border-radius:10px;background:#0a1424;color:#fff;
        text-decoration:none;font-weight:750;font-size:12px}
      .vta-link.vta-primary{border-color:#7041ff;background:#5121d9}
      .vta-empty{padding:25px;text-align:center;color:#8c9ab4;border:1px dashed #2b3b57;border-radius:12px}
      @media(max-width:640px){
        #vtrade-menu-button{top:12px;right:12px}
        .vta-session-links{grid-template-columns:1fr}
        .vta-status{display:none}
        .vta-all-session{padding:14px;border-radius:15px}
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    renderMenu();
    addMenuButton();
    renderSessions();
  }

  window.VTradeRefreshAllSessions = renderSessions;
  window.VTradeSetLanguage = setLang;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
