/* ==========================================================================
   HSMS - shelter.js
   Powers shelters.html (CRUD) and shelter-log.html (check-in/out + roster).
   ========================================================================== */

let shelterCurrentUser = null;
let selectedPerson = null;

(async function init() {
  shelterCurrentUser = hsmsRequireRole(["super_admin", "shelter_admin"]);
  if (!shelterCurrentUser) return;

  if (document.getElementById("shelterBody")) {
    hsmsRenderShell("shelters.html");
    initShelterCrudPage();
  }

  if (document.getElementById("rosterBody")) {
    hsmsRenderShell("shelter-log.html");
    initShelterLogPage();
  }
})();

/* ----------------------------- shelters.html ----------------------------- */

function initShelterCrudPage() {
  document.getElementById("newShelterBtn").addEventListener("click", () => openShelterForm());
  document.getElementById("cancelShelterBtn").addEventListener("click", () => {
    document.getElementById("shelterFormCard").style.display = "none";
  });
  document.getElementById("shelterForm").addEventListener("submit", saveShelter);
  loadShelterList();
}

function openShelterForm(shelter) {
  document.getElementById("shelterFormCard").style.display = "block";
  document.getElementById("shelterFormTitle").textContent = shelter ? "Edit Shelter" : "Add Shelter";
  document.getElementById("shelter_id").value = shelter?.id || "";
  document.getElementById("s_name").value = shelter?.name || "";
  document.getElementById("s_phone").value = shelter?.contact_phone || "";
  document.getElementById("s_address").value = shelter?.address || "";
  document.getElementById("s_city").value = shelter?.city || "";
  document.getElementById("s_state").value = shelter?.state || "";
  document.getElementById("s_capacity").value = shelter?.capacity || "";
  document.getElementById("s_lat").value = shelter?.latitude || "";
  document.getElementById("s_lng").value = shelter?.longitude || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveShelter(e) {
  e.preventDefault();
  const id = document.getElementById("shelter_id").value;
  const capacity = Number(document.getElementById("s_capacity").value);

  const payload = {
    name: document.getElementById("s_name").value.trim(),
    contact_phone: document.getElementById("s_phone").value.trim() || null,
    address: document.getElementById("s_address").value.trim(),
    city: document.getElementById("s_city").value.trim() || null,
    state: document.getElementById("s_state").value.trim() || null,
    capacity,
    latitude: document.getElementById("s_lat").value || null,
    longitude: document.getElementById("s_lng").value || null,
  };

  try {
    if (id) {
      const { error } = await sb.from("shelters").update(payload).eq("id", id);
      if (error) throw error;
      hsmsToast("Shelter updated");
    } else {
      payload.available_beds = capacity;
      const { error } = await sb.from("shelters").insert(payload);
      if (error) throw error;
      hsmsToast("Shelter added");
    }
    document.getElementById("shelterFormCard").style.display = "none";
    document.getElementById("shelterForm").reset();
    loadShelterList();
  } catch (err) {
    console.error(err);
    hsmsToast("Could not save shelter", "error");
  }
}

async function loadShelterList() {
  const body = document.getElementById("shelterBody");
  try {
    const { data, error } = await sb.from("shelters").select("*").order("name");
    if (error) throw error;
    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="6">No shelters added yet.</td></tr>`;
      return;
    }
    body.innerHTML = data
      .map(
        (s) => `<tr>
          <td><strong>${s.name}</strong><br><small style="color:var(--text-muted);">${s.address}</small></td>
          <td>${s.city || "—"}</td>
          <td>${s.capacity}</td>
          <td>${s.available_beds ?? "—"}</td>
          <td>${s.contact_phone || "—"}</td>
          <td><button class="btn btn-outline btn-sm" onclick='editShelterById("${s.id}")'>Edit</button></td>
        </tr>`
      )
      .join("");
    window._sheltersCache = data;
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="6">Could not load shelters.</td></tr>`;
  }
}

function editShelterById(id) {
  const shelter = (window._sheltersCache || []).find((s) => s.id === id);
  if (shelter) openShelterForm(shelter);
}

/* ---------------------------- shelter-log.html ---------------------------- */

function initShelterLogPage() {
  document.getElementById("logSearchBtn").addEventListener("click", searchPersonForLog);
  document.getElementById("logSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") searchPersonForLog();
  });
  document.getElementById("checkInBtn").addEventListener("click", doCheckIn);
  document.getElementById("checkOutBtn").addEventListener("click", doCheckOut);
  loadShelterSelect();
  loadRoster();
}

async function loadShelterSelect() {
  const select = document.getElementById("ci_shelter");
  try {
    const { data, error } = await sb.from("shelters").select("id, name, available_beds").order("name");
    if (error) throw error;
    select.innerHTML = (data || [])
      .map((s) => `<option value="${s.id}">${s.name} (${s.available_beds ?? 0} beds free)</option>`)
      .join("");
  } catch (err) {
    console.error(err);
  }
}

async function searchPersonForLog() {
  const term = document.getElementById("logSearch").value.trim();
  const resultsEl = document.getElementById("logSearchResults");
  if (!term) {
    resultsEl.innerHTML = "";
    return;
  }
  try {
    const { data, error } = await sb
      .from("persons")
      .select("id, tracking_id, first_name, last_name, profile_status")
      .or(`tracking_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .limit(10);
    if (error) throw error;

    if (!data || data.length === 0) {
      resultsEl.innerHTML = `<p style="color:var(--text-muted);">No matches found.</p>`;
      return;
    }

    resultsEl.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Tracking ID</th><th>Name</th><th>Status</th><th></th></tr></thead>
      <tbody>${data
        .map(
          (p) => `<tr>
            <td>${p.tracking_id}</td>
            <td>${p.first_name || "Unknown"} ${p.last_name || ""}</td>
            <td>${hsmsBadge(p.profile_status)}</td>
            <td><button class="btn btn-outline btn-sm" onclick='selectPersonForLog(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Select</button></td>
          </tr>`
        )
        .join("")}</tbody></table></div>`;
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<p>Search failed.</p>`;
  }
}

function selectPersonForLog(person) {
  selectedPerson = person;
  document.getElementById("actionCard").style.display = "block";
  document.getElementById("actionTitle").textContent = `${person.first_name || "Unknown"} ${person.last_name || ""} — ${person.tracking_id}`;
  window.scrollTo({ top: document.getElementById("actionCard").offsetTop - 80, behavior: "smooth" });
}

async function doCheckIn() {
  if (!selectedPerson) return;
  const shelterId = document.getElementById("ci_shelter").value;
  const bed = document.getElementById("ci_bed").value.trim();
  const remarks = document.getElementById("ci_remarks").value.trim();

  try {
    const { error: logErr } = await sb.from("shelter_logs").insert({
      person_id: selectedPerson.id,
      shelter_id: shelterId,
      check_in: new Date().toISOString(),
      bed_number: bed || null,
      logged_by: shelterCurrentUser.id,
      remarks: remarks || null,
    });
    if (logErr) throw logErr;

    await sb.from("persons").update({ profile_status: "in_shelter", shelter_id: shelterId }).eq("id", selectedPerson.id);

    const { data: shelter } = await sb.from("shelters").select("available_beds").eq("id", shelterId).single();
    if (shelter && shelter.available_beds > 0) {
      await sb.from("shelters").update({ available_beds: shelter.available_beds - 1 }).eq("id", shelterId);
    }

    hsmsToast("Checked in successfully");
    document.getElementById("actionCard").style.display = "none";
    loadShelterSelect();
    loadRoster();
  } catch (err) {
    console.error(err);
    hsmsToast("Check-in failed", "error");
  }
}

async function doCheckOut() {
  if (!selectedPerson) return;
  const reason = document.getElementById("co_reason").value;
  const remarks = document.getElementById("co_remarks").value.trim();

  try {
    const { data: openLog, error: findErr } = await sb
      .from("shelter_logs")
      .select("*")
      .eq("person_id", selectedPerson.id)
      .is("check_out", null)
      .order("check_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!openLog) {
      hsmsToast("No active check-in found for this person", "error");
      return;
    }

    await sb
      .from("shelter_logs")
      .update({ check_out: new Date().toISOString(), remarks: remarks || openLog.remarks })
      .eq("id", openLog.id);

    const newStatus = reason === "reunited" ? "reunited" : reason === "deceased" ? "deceased" : reason === "missing" ? "missing" : "active";
    await sb.from("persons").update({ profile_status: newStatus, shelter_id: null }).eq("id", selectedPerson.id);

    const { data: shelter } = await sb.from("shelters").select("available_beds, capacity").eq("id", openLog.shelter_id).single();
    if (shelter) {
      const updated = Math.min((shelter.available_beds || 0) + 1, shelter.capacity);
      await sb.from("shelters").update({ available_beds: updated }).eq("id", openLog.shelter_id);
    }

    hsmsToast("Checked out successfully");
    document.getElementById("actionCard").style.display = "none";
    loadShelterSelect();
    loadRoster();
  } catch (err) {
    console.error(err);
    hsmsToast("Check-out failed", "error");
  }
}

async function loadRoster() {
  const body = document.getElementById("rosterBody");
  try {
    const { data, error } = await sb
      .from("shelter_logs")
      .select("*, persons(tracking_id, first_name, last_name), shelters(name)")
      .is("check_out", null)
      .order("check_in", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="5">No one is currently checked in.</td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (l) => `<tr>
          <td>${l.persons?.tracking_id || "—"}</td>
          <td>${l.persons?.first_name || "Unknown"} ${l.persons?.last_name || ""}</td>
          <td>${l.shelters?.name || "—"}</td>
          <td>${l.bed_number || "—"}</td>
          <td>${hsmsFormatDate(l.check_in)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="5">Could not load roster.</td></tr>`;
  }
}
