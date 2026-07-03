/* ==========================================================================
   HSMS - list.js
   Powers person-list.html search, filters, and audit-facing list fields.
   ========================================================================== */

let listCurrentUser = null;
let listUsers = [];
let listShelters = [];

(async function init() {
  listCurrentUser = hsmsRequireAuth();
  if (!listCurrentUser) return;
  hsmsRenderShell("person-list.html");

  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.getElementById("searchInput").addEventListener("keyup", (e) => {
    if (e.key === "Enter") runSearch();
  });
  document.getElementById("statusFilter").addEventListener("change", runSearch);
  document.getElementById("clearAdminFiltersBtn").addEventListener("click", clearAdminFilters);

  await loadAdminFilterOptions();

  if (canUseAdminFilters()) {
    document.getElementById("adminRecordFilters").style.display = "flex";
    ["registeredByFilter", "shelterFilter", "registrationDateFilter"].forEach((id) => {
      document.getElementById(id).addEventListener("change", runSearch);
    });
    document.getElementById("aadhaarFilter").addEventListener("keyup", (e) => {
      if (e.key === "Enter") runSearch();
    });
  }

  await runSearch();
})();

function canUseAdminFilters() {
  return ["super_admin", "shelter_admin"].includes(listCurrentUser?.role);
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function listUserName(userId) {
  const user = listUsers.find((u) => u.id === userId);
  return user?.full_name || "Unknown";
}

function listShelterName(shelterId) {
  const shelter = listShelters.find((s) => s.id === shelterId);
  return shelter?.name || "Not assigned";
}

async function loadAdminFilterOptions() {
  try {
    const [{ data: users }, { data: shelters }] = await Promise.all([
      sb.from("users").select("id, full_name, role").order("full_name"),
      sb.from("shelters").select("id, name").order("name"),
    ]);
    listUsers = users || [];
    listShelters = shelters || [];

    document.getElementById("registeredByFilter").innerHTML =
      `<option value="">All Registered By</option>` +
      listUsers.map((u) => `<option value="${u.id}">${u.full_name} (${hsmsRoleLabel(u.role)})</option>`).join("");
    document.getElementById("shelterFilter").innerHTML =
      `<option value="">All Shelters</option>` +
      listShelters.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  } catch (err) {
    console.error(err);
  }
}

function clearAdminFilters() {
  ["registeredByFilter", "shelterFilter", "registrationDateFilter", "aadhaarFilter"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  runSearch();
}

async function runSearch() {
  const body = document.getElementById("listBody");
  body.innerHTML = `<tr><td colspan="11">Loading...</td></tr>`;

  const term = document.getElementById("searchInput").value.trim();
  const status = document.getElementById("statusFilter").value;
  const registeredBy = document.getElementById("registeredByFilter").value;
  const shelterId = document.getElementById("shelterFilter").value;
  const registrationDate = document.getElementById("registrationDateFilter").value;
  const aadhaar = document.getElementById("aadhaarFilter").value.trim();

  try {
    let query = sb
      .from("persons")
      .select("id, tracking_id, first_name, last_name, gender, age_est, found_area, profile_status, aadhaar_status, aadhaar_number, registered_by, shelter_id, registered_at")
      .order("registered_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("profile_status", status);

    if (canUseAdminFilters()) {
      if (registeredBy) query = query.eq("registered_by", registeredBy);
      if (shelterId) query = query.eq("shelter_id", shelterId);
      if (registrationDate) {
        query = query.gte("registered_at", `${registrationDate}T00:00:00`).lt("registered_at", `${addDays(registrationDate, 1)}T00:00:00`);
      }
      if (aadhaar) query = query.ilike("aadhaar_number", `%${aadhaar}%`);
    }

    if (term) {
      query = query.or(
        `tracking_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,found_area.ilike.%${term}%,aadhaar_number.ilike.%${term}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="big">Search</div>No matching persons found.</div></td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (p) => `<tr>
          <td><strong>${p.tracking_id}</strong></td>
          <td>${p.first_name || "Unknown"} ${p.last_name || ""}</td>
          <td>${p.gender || "-"}</td>
          <td>${p.age_est ?? "-"}</td>
          <td>${p.found_area || "-"}</td>
          <td>${hsmsBadge(p.profile_status)}</td>
          <td>${p.aadhaar_status ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-red">Missing</span>'}</td>
          <td>${listUserName(p.registered_by)}</td>
          <td>${listShelterName(p.shelter_id)}</td>
          <td>${hsmsFormatDate(p.registered_at)}</td>
          <td><a href="person-profile.html?id=${p.id}" class="btn btn-outline btn-sm">View</a></td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="11">Could not load list.</td></tr>`;
  }
}
