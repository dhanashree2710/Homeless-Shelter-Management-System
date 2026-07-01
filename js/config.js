/* ==========================================================================
   HSMS - config.js
   Supabase initialization + shared helper functions used across all pages.
   ========================================================================== */

const SUPABASE_URL = "https://pnocjlnktbeklbhorepo.supabase.co/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBub2NqbG5rdGJla2xiaG9yZXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDk4MTgsImV4cCI6MjA5ODM4NTgxOH0.gypp5pTenp8rNAZKtDTts0gqK3PQ-7ciOUgVocqq7Os";

// supabase-js UMD build is loaded via CDN in each HTML file and exposes `window.supabase`.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------------------------------------------------------------------- *
 * Session / Auth helpers
 * ---------------------------------------------------------------------- */

const HSMS_SESSION_KEY = "hsms_user";

function hsmsSaveSession(userRow) {
  sessionStorage.setItem(HSMS_SESSION_KEY, JSON.stringify(userRow));
}

function hsmsGetSession() {
  const raw = sessionStorage.getItem(HSMS_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function hsmsClearSession() {
  sessionStorage.removeItem(HSMS_SESSION_KEY);
}

/** Redirects to login.html (preserving where the user was headed) if no active HSMS session exists. Call at top of protected pages. */
function hsmsRequireAuth() {
  const user = hsmsGetSession();
  if (!user) {
    const here = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `login.html?next=${encodeURIComponent(here)}`;
    return null;
  }
  return user;
}

/** Navigates to a page, routing through login first if the user isn't signed in yet. Used by nav links so the public dashboard stays open. */
function hsmsGoTo(page) {
  const user = hsmsGetSession();
  if (!user) {
    window.location.href = `login.html?next=${encodeURIComponent(page)}`;
  } else {
    window.location.href = page;
  }
}

/** Restrict a page to certain roles. Pass an array e.g. ['super_admin']. */
function hsmsRequireRole(allowedRoles) {
  const user = hsmsRequireAuth();
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    alert("You do not have permission to access this page.");
    window.location.href = "index.html";
    return null;
  }
  return user;
}

/** Returns the currently signed-in user without redirecting, for pages (like the public dashboard) that work for guests too. */
function hsmsOptionalAuth() {
  return hsmsGetSession();
}

function hsmsLogout() {
  hsmsClearSession();
  window.location.href = "login.html";
}

/* ---------------------------------------------------------------------- *
 * UI helpers
 * ---------------------------------------------------------------------- */

/** Renders the shared top navbar + sidebar into elements with id="hsms-topbar" / "hsms-sidebar".
 *  Works for both signed-in users and guests (guests see a public, read-only dashboard
 *  and are routed to login the moment they click anything that needs an account). */
function hsmsRenderShell(activePage) {
  const user = hsmsGetSession();
  const navEl = document.getElementById("hsms-topbar");
  const sideEl = document.getElementById("hsms-sidebar");
  if (!navEl || !sideEl) return;

  navEl.innerHTML = user
    ? `
    <div class="hsms-topbar-left">
      <button class="hsms-burger" id="hsmsBurger">&#9776;</button>
      <span class="hsms-topbar-title">Homeless Shelter Management System</span>
    </div>
    <div class="hsms-topbar-right">
      <span class="hsms-user-pill">${user.full_name} <small>(${hsmsRoleLabel(user.role)})</small></span>
      <button class="btn-link" onclick="hsmsLogout()">Logout</button>
    </div>`
    : `
    <div class="hsms-topbar-left">
      <button class="hsms-burger" id="hsmsBurger">&#9776;</button>
      <span class="hsms-topbar-title">Homeless Shelter Management System</span>
    </div>
    <div class="hsms-topbar-right">
      <span class="hsms-user-pill">Guest — viewing public dashboard</span>
      <a class="btn btn-orange btn-sm" href="login.html">Staff Login</a>
    </div>`;

  const items = [
    { page: "index.html", label: "Dashboard", icon: "🏠", roles: ["super_admin", "shelter_admin", "field_worker", "guest"] },
    { page: "person-registration.html", label: "New Registration", icon: "📝", roles: ["super_admin", "shelter_admin", "field_worker"] },
    { page: "person-list.html", label: "Person List", icon: "👥", roles: ["super_admin", "shelter_admin", "field_worker"] },
    { page: "shelters.html", label: "Shelters", icon: "🏘️", roles: ["super_admin", "shelter_admin"] },
    { page: "shelter-log.html", label: "Check-In / Check-Out", icon: "🛏️", roles: ["super_admin", "shelter_admin"] },
    { page: "missing-persons.html", label: "Missing Persons", icon: "🚨", roles: ["super_admin", "shelter_admin"] },
    { page: "public-tips.html", label: "Public Tips Portal", icon: "💬", roles: ["super_admin", "shelter_admin", "guest"] },
    { page: "users.html", label: "User Management", icon: "🔐", roles: ["super_admin"] },
    { page: "reports.html", label: "Reports", icon: "📊", roles: ["super_admin", "shelter_admin"] },
  ];

  const role = user ? user.role : "guest";
  // Guests see every item in the menu (so they can discover what the system offers),
  // but anything beyond the public pages routes them through login first.
  const visible = user ? items.filter((i) => i.roles.includes(role)) : items;

  sideEl.innerHTML = `
    <div class="hsms-brand">
      <img src="images/logo.png" alt="HSMS" />
    </div>
    <nav class="hsms-nav-links">
      ${visible
        .map(
          (i) => `<a href="javascript:void(0)" onclick="hsmsGoTo('${i.page}')" class="${activePage === i.page ? "active" : ""}">
              <span class="hsms-nav-icon">${i.icon}</span>${i.label}${!user && !i.roles.includes("guest") ? ' <small class="lock">🔒</small>' : ""}
            </a>`
        )
        .join("")}
    </nav>`;

  const burger = document.getElementById("hsmsBurger");
  if (burger) {
    burger.addEventListener("click", () => {
      document.body.classList.toggle("hsms-sidebar-open");
    });
  }
}

function hsmsRoleLabel(role) {
  return (
    {
      super_admin: "Super Admin",
      shelter_admin: "Shelter Admin",
      field_worker: "Field Worker",
    }[role] || role
  );
}

function hsmsToast(message, type = "success") {
  let container = document.getElementById("hsms-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "hsms-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `hsms-toast hsms-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function hsmsFormatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString();
}

function hsmsBadge(status) {
  const map = {
    active: "badge-blue",
    missing: "badge-red",
    in_shelter: "badge-green",
    reunited: "badge-teal",
    deceased: "badge-gray",
  };
  return `<span class="badge ${map[status] || "badge-gray"}">${(status || "").replace(/_/g, " ")}</span>`;
}

/** Generates a tracking ID like HSMS-2026-PUN-0001 using a city code + sequence lookup in localStorage as a free-tier-friendly fallback. */
async function hsmsGenerateTrackingId(cityCode) {
  const year = new Date().getFullYear();
  const code = (cityCode || "GEN").toUpperCase().slice(0, 3);
  const { count } = await sb
    .from("persons")
    .select("id", { count: "exact", head: true })
    .like("tracking_id", `HSMS-${year}-${code}-%`);
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `HSMS-${year}-${code}-${seq}`;
}

function hsmsMaskAadhaar(num) {
  if (!num || num.length < 4) return "—";
  return `XXXX-XXXX-${num.slice(-4)}`;
}
