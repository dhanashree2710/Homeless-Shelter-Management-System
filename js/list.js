/* ==========================================================================
   HSMS - list.js
   Powers person-list.html (search/filter) and is reused for simple
   list rendering helpers.
   ========================================================================== */

(async function init() {
  const user = hsmsRequireAuth();
  if (!user) return;
  hsmsRenderShell("person-list.html");

  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.getElementById("searchInput").addEventListener("keyup", (e) => {
    if (e.key === "Enter") runSearch();
  });
  document.getElementById("statusFilter").addEventListener("change", runSearch);

  await runSearch();
})();

async function runSearch() {
  const body = document.getElementById("listBody");
  body.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;

  const term = document.getElementById("searchInput").value.trim();
  const status = document.getElementById("statusFilter").value;

  try {
    let query = sb
      .from("persons")
      .select("id, tracking_id, first_name, last_name, gender, age_est, found_area, profile_status, aadhaar_status")
      .order("registered_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("profile_status", status);
    if (term) {
      query = query.or(
        `tracking_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,found_area.ilike.%${term}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="big">🔍</div>No matching persons found.</div></td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (p) => `<tr>
          <td><strong>${p.tracking_id}</strong></td>
          <td>${p.first_name || "Unknown"} ${p.last_name || ""}</td>
          <td>${p.gender || "—"}</td>
          <td>${p.age_est ?? "—"}</td>
          <td>${p.found_area || "—"}</td>
          <td>${hsmsBadge(p.profile_status)}</td>
          <td>${p.aadhaar_status ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-red">Missing</span>'}</td>
          <td><a href="person-profile.html?id=${p.id}" class="btn btn-outline btn-sm">View</a></td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="8">Could not load list.</td></tr>`;
  }
}
