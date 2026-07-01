/* ==========================================================================
   HSMS - user.js
   Powers users.html — super_admin only CRUD over the users table.
   ========================================================================== */

let userPageAdmin = null;

(async function init() {
  userPageAdmin = hsmsRequireRole(["super_admin"]);
  if (!userPageAdmin) return;
  hsmsRenderShell("users.html");

  document.getElementById("newUserBtn").addEventListener("click", () => openUserForm());
  document.getElementById("cancelUserBtn").addEventListener("click", () => {
    document.getElementById("userFormCard").style.display = "none";
  });
  document.getElementById("userForm").addEventListener("submit", saveUser);

  await loadShelterOptionsForUser();
  await loadUsers();
})();

async function loadShelterOptionsForUser() {
  const select = document.getElementById("u_shelter");
  try {
    const { data, error } = await sb.from("shelters").select("id, name").order("name");
    if (error) throw error;
    (data || []).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }
}

function openUserForm(user) {
  document.getElementById("userFormCard").style.display = "block";
  document.getElementById("userFormTitle").textContent = user ? "Edit User" : "Add User";
  document.getElementById("u_id").value = user?.id || "";
  document.getElementById("u_name").value = user?.full_name || "";
  document.getElementById("u_email").value = user?.email || "";
  document.getElementById("u_password").value = "";
  document.getElementById("u_phone").value = user?.phone || "";
  document.getElementById("u_role").value = user?.role || "field_worker";
  document.getElementById("u_shelter").value = user?.shelter_id || "";
  document.getElementById("u_active").checked = user ? !!user.is_active : true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById("u_id").value;
  const password = document.getElementById("u_password").value.trim();

  const payload = {
    full_name: document.getElementById("u_name").value.trim(),
    email: document.getElementById("u_email").value.trim().toLowerCase(),
    phone: document.getElementById("u_phone").value.trim() || null,
    role: document.getElementById("u_role").value,
    shelter_id: document.getElementById("u_shelter").value || null,
    is_active: document.getElementById("u_active").checked,
  };
  if (password) payload.password = password;

  try {
    if (id) {
      const { error } = await sb.from("users").update(payload).eq("id", id);
      if (error) throw error;
      hsmsToast("User updated");
    } else {
      if (!password) {
        hsmsToast("Password is required for new users", "error");
        return;
      }
      payload.password = password;
      const { error } = await sb.from("users").insert(payload);
      if (error) throw error;
      hsmsToast("User created");
    }
    document.getElementById("userFormCard").style.display = "none";
    document.getElementById("userForm").reset();
    await loadUsers();
  } catch (err) {
    console.error(err);
    hsmsToast("Could not save user (email may already exist)", "error");
  }
}

async function loadUsers() {
  const body = document.getElementById("userBody");
  try {
    const { data, error } = await sb.from("users").select("*, shelters(name)").order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="6">No users found.</td></tr>`;
      return;
    }

    window._usersCache = data;
    body.innerHTML = data
      .map(
        (u) => `<tr>
          <td>${u.full_name}</td>
          <td>${u.email}</td>
          <td>${hsmsRoleLabel(u.role)}</td>
          <td>${u.shelters?.name || "—"}</td>
          <td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
          <td><button class="btn btn-outline btn-sm" onclick='editUserById("${u.id}")'>Edit</button></td>
        </tr>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="6">Could not load users.</td></tr>`;
  }
}

function editUserById(id) {
  const user = (window._usersCache || []).find((u) => u.id === id);
  if (user) openUserForm(user);
}
