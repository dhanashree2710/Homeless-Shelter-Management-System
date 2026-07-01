/* ==========================================================================
   HSMS - dashboard.js
   ========================================================================== */

(async function init() {
  const user = hsmsOptionalAuth();
  hsmsRenderShell("index.html");

  if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.full_name.split(" ")[0]} 👋`;
    document.getElementById("welcomeSub").innerHTML =
      'Overview of registrations, shelters and active alerts. <a href="javascript:void(0)" onclick="hsmsGoTo(\'person-registration.html\')">+ New Registration</a>';
  } else {
    document.getElementById("welcomeMsg").textContent = "Welcome to HSMS";
    document.getElementById("welcomeSub").innerHTML =
      'You\'re viewing the public dashboard. <a href="login.html">Sign in</a> as staff to register people, manage shelters and more.';
    // Recent registrations contain staff-only PII — hide for guests.
    document.getElementById("recentCard").style.display = "none";
  }

  await loadStats();
  if (user) await loadRecentPersons();
  await loadActiveMissing();
})();

async function loadStats() {
  try {
    const [{ count: total }, { count: inShelter }, { count: missing }, { data: shelters }, { count: tips }] =
      await Promise.all([
        sb.from("persons").select("id", { count: "exact", head: true }),
        sb.from("persons").select("id", { count: "exact", head: true }).eq("profile_status", "in_shelter"),
        sb.from("persons").select("id", { count: "exact", head: true }).eq("is_missing", true),
        sb.from("shelters").select("available_beds"),
        sb.from("public_tips").select("id", { count: "exact", head: true }),
      ]);

    document.getElementById("statTotal").textContent = total ?? 0;
    document.getElementById("statInShelter").textContent = inShelter ?? 0;
    document.getElementById("statMissing").textContent = missing ?? 0;
    document.getElementById("statShelters").textContent = (shelters || []).length;
    document.getElementById("statBeds").textContent = (shelters || []).reduce(
      (sum, s) => sum + (s.available_beds || 0),
      0
    );
    document.getElementById("statTips").textContent = tips ?? 0;
  } catch (err) {
    console.error(err);
    hsmsToast("Failed to load dashboard stats", "error");
  }
}

async function loadRecentPersons() {
  const body = document.getElementById("recentBody");
  try {
    const { data, error } = await sb
      .from("persons")
      .select("tracking_id, first_name, last_name, profile_status, found_at, id")
      .order("registered_at", { ascending: false })
      .limit(6);
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="4">No registrations yet.</td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (p) => `<tr>
          <td><a href="person-profile.html?id=${p.id}">${p.tracking_id}</a></td>
          <td>${(p.first_name || "Unknown")} ${p.last_name || ""}</td>
          <td>${hsmsBadge(p.profile_status)}</td>
          <td>${hsmsFormatDate(p.found_at)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="4">Could not load data.</td></tr>`;
  }
}

async function loadActiveMissing() {
  const body = document.getElementById("missingBody");
  try {
    const { data, error } = await sb
      .from("missing_alerts")
      .select("id, title, posted_at, person_id, persons(tracking_id)")
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .limit(6);
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="3">No active missing alerts.</td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (a) => `<tr>
          <td><a href="person-profile.html?id=${a.person_id}">${a.persons?.tracking_id || "—"}</a></td>
          <td>${a.title || "Missing Person"}</td>
          <td>${hsmsFormatDate(a.posted_at)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="3">Could not load data.</td></tr>`;
  }
}
