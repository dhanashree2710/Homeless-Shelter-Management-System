/* ==========================================================================
   HSMS - person.js
   Handles the multi-step New Registration form (person-registration.html).
   ========================================================================== */

let hsmsCurrentUser = null;
let relativeRowCount = 0;

(async function init() {
  hsmsCurrentUser = hsmsRequireAuth();
  if (!hsmsCurrentUser) return;
  hsmsRenderShell("person-registration.html");

  await loadShelterOptions();
  bindStaticEvents();
})();

function bindStaticEvents() {
  document.getElementById("gpsBtn").addEventListener("click", captureGps);

  document.getElementById("aadhaar_status").addEventListener("change", (e) => {
    const has = e.target.value === "true";
    document.getElementById("aadhaarBlock").style.display = has ? "block" : "none";
    document.getElementById("missingNotice").style.display = has ? "none" : "block";
  });

  document.getElementById("has_relatives").addEventListener("change", (e) => {
    const yes = e.target.value === "true";
    document.getElementById("relativesBlock").style.display = yes ? "block" : "none";
    if (yes && relativeRowCount === 0) addRelativeRow();
  });

  document.getElementById("addRelativeBtn").addEventListener("click", addRelativeRow);

  document.getElementById("regForm").addEventListener("submit", submitRegistration);

  document.querySelectorAll(".photo-slot input[type=file]").forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const slot = e.target.closest(".photo-slot");
      let img = slot.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        slot.prepend(img);
      }
      if (file) img.src = URL.createObjectURL(file);
    });
  });
}

function hsmsGoStep(step) {
  document.querySelectorAll(".form-section").forEach((s) => s.classList.remove("active"));
  document.querySelector(`.form-section[data-section="${step}"]`).classList.add("active");

  document.querySelectorAll(".step-pill").forEach((p) => {
    const n = Number(p.dataset.step);
    p.classList.remove("active", "done");
    if (n === step) p.classList.add("active");
    else if (n < step) p.classList.add("done");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function captureGps() {
  if (!navigator.geolocation) {
    hsmsToast("Geolocation not supported on this device", "error");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById("found_lat").value = pos.coords.latitude.toFixed(8);
      document.getElementById("found_lng").value = pos.coords.longitude.toFixed(8);
      hsmsToast("GPS location captured");
    },
    () => hsmsToast("Could not capture GPS location", "error")
  );
}

async function loadShelterOptions() {
  const select = document.getElementById("referred_shelter");
  try {
    const { data, error } = await sb.from("shelters").select("id, name, city").order("name");
    if (error) throw error;
    (data || []).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name}${s.city ? " — " + s.city : ""}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }
}

function addRelativeRow() {
  relativeRowCount++;
  const id = relativeRowCount;
  const wrap = document.createElement("div");
  wrap.className = "relative-row";
  wrap.dataset.rowId = id;
  wrap.innerHTML = `
    <button type="button" class="remove-row" onclick="this.closest('.relative-row').remove()">✕</button>
    <div class="grid-2">
      <div class="field"><label>Relative Full Name</label><input type="text" class="rel-name" /></div>
      <div class="field"><label>Relationship</label>
        <select class="rel-relationship">
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="brother">Brother</option>
          <option value="sister">Sister</option>
          <option value="wife">Wife</option>
          <option value="husband">Husband</option>
          <option value="child">Child</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Phone Number</label><input type="text" class="rel-phone" placeholder="+91 ..." /></div>
      <div class="field"><label>Contact Status</label>
        <select class="rel-status">
          <option value="not_contacted">Not Contacted</option>
          <option value="contacted">Contacted</option>
          <option value="unreachable">Unreachable</option>
          <option value="refused">Refused</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Address</label><textarea class="rel-address" rows="2"></textarea></div>
    <div class="field"><label>Notes</label><textarea class="rel-notes" rows="2"></textarea></div>
  `;
  document.getElementById("relativeRows").appendChild(wrap);
}

async function submitRegistration(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    const foundAddress = document.getElementById("found_address").value.trim();
    if (!foundAddress) {
      hsmsToast("Found address is required", "error");
      hsmsGoStep(1);
      return;
    }

    const cityCode = document.getElementById("city_code").value.trim() || "GEN";
    const trackingId = await hsmsGenerateTrackingId(cityCode);
    const aadhaarStatus = document.getElementById("aadhaar_status").value === "true";
    const hasRelatives = document.getElementById("has_relatives").value === "true";
    const shelterId = document.getElementById("referred_shelter").value || null;

    const personPayload = {
      tracking_id: trackingId,
      first_name: document.getElementById("first_name").value.trim() || "Unknown",
      last_name: document.getElementById("last_name").value.trim() || null,
      alias: document.getElementById("alias").value.trim() || null,
      gender: document.getElementById("gender").value,
      age_est: document.getElementById("age_est").value ? Number(document.getElementById("age_est").value) : null,
      physical_description: document.getElementById("physical_description").value.trim() || null,
      found_lat: document.getElementById("found_lat").value || null,
      found_lng: document.getElementById("found_lng").value || null,
      found_address: foundAddress,
      found_area: document.getElementById("found_area").value.trim() || null,
      aadhaar_status: aadhaarStatus,
      aadhaar_number: aadhaarStatus ? document.getElementById("aadhaar_number").value.trim() || null : null,
      is_missing: !aadhaarStatus,
      profile_status: shelterId ? "in_shelter" : "active",
      has_relatives: hasRelatives,
      case_notes: document.getElementById("case_notes").value.trim() || null,
      shelter_id: shelterId,
      registered_by: hsmsCurrentUser.id,
    };

    const { data: person, error: personErr } = await sb.from("persons").insert(personPayload).select().single();
    if (personErr) throw personErr;

    // Relatives
    if (hasRelatives) {
      const rows = Array.from(document.querySelectorAll(".relative-row")).map((row) => ({
        person_id: person.id,
        relative_name: row.querySelector(".rel-name").value.trim() || null,
        relationship: row.querySelector(".rel-relationship").value,
        phone: row.querySelector(".rel-phone").value.trim() || null,
        address: row.querySelector(".rel-address").value.trim() || null,
        contact_status: row.querySelector(".rel-status").value,
        notes: row.querySelector(".rel-notes").value.trim() || null,
      }));
      if (rows.length) {
        const { error: relErr } = await sb.from("person_relatives").insert(rows);
        if (relErr) console.error(relErr);
      }
    }

    // Photos
    const photoInputs = document.querySelectorAll(".photo-slot input[type=file]");
    for (const input of photoInputs) {
      const file = input.files[0];
      if (!file) continue;
      const photoType = input.closest(".photo-slot").dataset.type;
      const path = `profiles/${person.id}/photos/${photoType}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await sb.storage.from("person-photos").upload(path, file, { upsert: true });
      if (upErr) {
        console.error(upErr);
        continue;
      }
      const { data: urlData } = sb.storage.from("person-photos").getPublicUrl(path);
      await sb.from("person_photos").insert({
        person_id: person.id,
        photo_url: urlData.publicUrl,
        photo_type: photoType,
        uploaded_by: hsmsCurrentUser.id,
      });
    }

    // If no Aadhaar, auto-create a missing alert in review queue.
    if (!aadhaarStatus) {
      await sb.from("missing_alerts").insert({
        person_id: person.id,
        posted_by: hsmsCurrentUser.id,
        title: `Missing Person — ${trackingId}`,
        description: "Auto-flagged at registration: no Aadhaar available.",
        reason: "no_aadhaar_at_registration",
        is_active: false, // pending admin review before publishing publicly
      });
    }

    hsmsToast(`Registered successfully — ${trackingId}`);
    setTimeout(() => {
      window.location.href = `person-profile.html?id=${person.id}`;
    }, 800);
  } catch (err) {
    console.error(err);
    hsmsToast("Registration failed. Please check required fields.", "error");
    btn.disabled = false;
    btn.textContent = "✓ Submit Registration";
  }
}
