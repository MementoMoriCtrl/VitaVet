(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "usuarios") return;

  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#usersTableBody");
  const feedback = document.querySelector("#usersFeedback");
  const formFeedback = document.querySelector("#userFormFeedback");
  const dialog = document.querySelector("#userDialog");
  const form = document.querySelector("#userForm");
  const title = document.querySelector("#userDialogTitle");
  const passwordInput = form.elements.password;
  const passwordNote = document.querySelector("#passwordNote");
  const currentUser = window.VitaVetAuth.getCurrentUser();
  let users = [];
  let editingId = null;

  const clearFeedback = (element) => {
    element.hidden = true;
    element.classList.remove("is-error");
    element.classList.remove("is-success");
    element.querySelector("[data-feedback-message]").textContent = "";
  };

  const showFeedback = (element, message, isError = false) => {
    element.querySelector("[data-feedback-message]").textContent = message;
    element.hidden = false;
    element.classList.toggle("is-error", isError);
    element.classList.toggle("is-success", !isError);
  };

  feedback.querySelector(".admin-feedback-close").addEventListener("click", () => clearFeedback(feedback));
  formFeedback.querySelector(".admin-feedback-close").addEventListener("click", () => clearFeedback(formFeedback));

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "Usuario no encontrado.",
    409: "El correo, DNI o nombre de usuario ya está registrado.",
    400: "Los datos ingresados no son válidos.",
    500: "Ocurrió un error del servidor. Inténtalo más tarde."
  }[status] || "No se pudo completar la operación.");

  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`http://localhost:8080/api/usuarios${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error("No se pudo conectar con el servidor. Verifica que el backend esté activo.");
    }
    if (response.status === 401) {
      window.VitaVetAuth.logout();
      throw new Error("Sesión expirada. Inicia sesión nuevamente.");
    }
    if (!response.ok) {
      let message = errorMessage(response.status);
      if (response.status === 400 || response.status === 409) {
        try {
          const data = await response.json();
          if (typeof data.message === "string" && data.message.trim()) message = data.message;
        } catch { /* El backend puede responder sin cuerpo. */ }
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : null;
  };

  const addCell = (row, value) => {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "No disponible" : String(value);
    row.append(cell);
  };

  const addStatusCell = (row, status) => {
    const cell = document.createElement("td");
    if (!status) {
      cell.textContent = "No disponible";
      row.append(cell);
      return;
    }
    const badge = document.createElement("span");
    badge.className = `admin-user-status is-${String(status).toLowerCase()}`;
    badge.textContent = String(status);
    cell.append(badge);
    row.append(cell);
  };

  const renderUsers = () => {
    if (!users.length) {
      tableBody.innerHTML = '<tr><td colspan="10" class="admin-table-message">No hay usuarios registrados.</td></tr>';
      return;
    }
    const rows = users.map((user) => {
      const row = document.createElement("tr");
      [user.idUsuario, user.nombre, user.apellido, user.dni, user.nombreUsuario, user.correo, user.telefono, user.rol]
        .forEach((value) => addCell(row, value));
      addStatusCell(row, user.estado);
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editUser(user.idUsuario));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deleteUser(user));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const loadUsers = async (preserveFeedbackOnError = false) => {
    tableBody.innerHTML = '<tr><td colspan="10" class="admin-table-message">Cargando usuarios...</td></tr>';
    try {
      const data = await request("");
      if (!Array.isArray(data)) throw new Error("La respuesta de usuarios no es válida.");
      users = data;
      const counter = document.querySelector("#countUsuarios");
      if (counter) counter.textContent = String(users.length);
      renderUsers();
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="10" class="admin-table-message">No se pudieron cargar los usuarios.</td></tr>';
      if (!preserveFeedbackOnError) showFeedback(feedback, error.message, true);
    }
  };

  const openForm = (user = null) => {
    editingId = user?.idUsuario ?? null;
    clearFeedback(feedback);
    clearFeedback(formFeedback);
    form.reset();
    title.textContent = editingId ? "Editar usuario" : "Nuevo usuario";
    form.elements.nombre.value = user?.nombre || "";
    form.elements.apellido.value = user?.apellido || "";
    form.elements.dni.value = user?.dni || "";
    form.elements.nombreUsuario.value = user?.nombreUsuario || "";
    form.elements.correo.value = user?.correo || "";
    form.elements.telefono.value = user?.telefono || "";
    form.elements.rol.value = user?.rol || "CLIENTE";
    form.elements.estado.value = user?.estado || "PENDIENTE";
    passwordInput.required = !editingId;
    passwordInput.value = "";
    passwordNote.hidden = !editingId;
    dialog.showModal();
  };

  const editUser = async (id) => {
    try {
      const user = await request(`/${encodeURIComponent(id)}`);
      openForm(user);
    } catch (error) {
      showFeedback(feedback, error.message, true);
    }
  };

  const deleteUser = async (user) => {
    const isSelf = currentUser && String(currentUser.idUsuario) === String(user.idUsuario);
    const target = `${user.nombre || ""} ${user.apellido || ""}`.trim() || `usuario #${user.idUsuario}`;
    const prompt = isSelf
      ? `Estás por eliminar tu propia cuenta ADMIN (${target}). Esta acción puede cerrar tu acceso al panel. ¿Deseas continuar?`
      : `¿Deseas eliminar la cuenta de ${target}?`;
    if (!window.confirm(prompt)) return;
    try {
      await request(`/${encodeURIComponent(user.idUsuario)}`, { method: "DELETE" });
      showFeedback(feedback, "Usuario eliminado correctamente.");
      await loadUsers(true);
    } catch (error) {
      showFeedback(feedback, error.message, true);
    }
  };

  document.querySelector("#newUserButton").addEventListener("click", () => openForm());
  document.querySelector("#cancelUserButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      nombre: form.elements.nombre.value.trim(),
      apellido: form.elements.apellido.value.trim(),
      dni: form.elements.dni.value.trim(),
      nombreUsuario: form.elements.nombreUsuario.value.trim(),
      correo: form.elements.correo.value.trim(),
      telefono: form.elements.telefono.value.trim(),
      rol: form.elements.rol.value,
      estado: form.elements.estado.value
    };
    const password = passwordInput.value;
    if (!editingId || password.trim()) payload.password = password;
    const isEditing = Boolean(editingId);
    clearFeedback(formFeedback);
    try {
      await request(isEditing ? `/${encodeURIComponent(editingId)}` : "", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(feedback, isEditing ? "Usuario actualizado correctamente." : "Usuario agregado correctamente");
      await loadUsers(true);
    } catch (error) {
      const identityConflict = error.status === 409
        && ["El DNI ya está registrado", "El nombre de usuario ya está registrado"].includes(error.message);
      if (!isEditing && identityConflict) {
        dialog.close();
        showFeedback(feedback, error.message, true);
      } else {
        showFeedback(formFeedback, error.message, true);
      }
    }
  });

  loadUsers();
})();
