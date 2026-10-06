(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "mascotas") return;

  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#petsTableBody");
  const feedback = document.querySelector("#petsFeedback");
  const dialog = document.querySelector("#petDialog");
  const form = document.querySelector("#petForm");
  const ownerSelect = form.elements.idUsuario;
  const title = document.querySelector("#petDialogTitle");
  let pets = [];
  let clients = [];
  let clientById = new Map();
  let editingId = null;

  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "Mascota o propietario no encontrado.",
    409: "No se pudo completar la operación porque hay información relacionada.",
    400: "Los datos ingresados no son válidos.",
    500: "Ocurrió un error del servidor. Inténtalo más tarde."
  }[status] || "No se pudo completar la operación.");

  const request = async (resource, options = {}) => {
    let response;
    try {
      response = await fetch(`http://localhost:8080/api/${resource}`, {
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
      try {
        const payload = await response.json();
        const backendMessage = [payload.message, payload.detail, payload.error]
          .find((value) => typeof value === "string" && value.trim());
        if (backendMessage) message = backendMessage;
      } catch { /* Algunas respuestas de error no incluyen JSON. */ }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : null;
  };

  const fullName = (user) => [user?.nombre, user?.apellido]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ");

  const addCell = (row, value) => {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "No disponible" : String(value);
    row.append(cell);
  };

  const renderPets = () => {
    if (!pets.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No hay mascotas registradas.</td></tr>';
      return;
    }
    const rows = pets.map((pet) => {
      const row = document.createElement("tr");
      const owner = clientById.get(String(pet.idUsuario));
      [pet.idMascota, pet.nombre, pet.tipo, pet.raza, pet.sexo, pet.edad, fullName(owner) || "No disponible"]
        .forEach((value) => addCell(row, value));
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editPet(pet.idMascota));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deletePet(pet));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const loadOwners = async () => {
    const data = await request("usuarios");
    if (!Array.isArray(data)) throw new Error("La respuesta de propietarios no es válida.");
    clients = data.filter((user) => user?.rol === "CLIENTE");
    clientById = new Map(clients.map((user) => [String(user.idUsuario), user]));
    const options = [new Option("Selecciona un propietario", "")];
    clients.forEach((client) => options.push(new Option(fullName(client) || "No disponible", String(client.idUsuario))));
    ownerSelect.replaceChildren(...options);
  };

  const loadPets = async (loadClientCatalog = false) => {
    tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">Cargando mascotas...</td></tr>';
    try {
      const [petData] = await Promise.all([
        request("mascotas"),
        loadClientCatalog ? loadOwners() : Promise.resolve()
      ]);
      if (!Array.isArray(petData)) throw new Error("La respuesta de mascotas no es válida.");
      pets = petData;
      const counter = document.querySelector("#countMascotas");
      if (counter) counter.textContent = String(pets.length);
      renderPets();
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No se pudieron cargar las mascotas.</td></tr>';
      showFeedback(error.message, true);
    }
  };

  const openForm = (pet = null) => {
    editingId = pet?.idMascota ?? null;
    form.reset();
    title.textContent = editingId ? "Editar mascota" : "Nueva mascota";
    form.elements.nombre.value = pet?.nombre || "";
    form.elements.tipo.value = pet?.tipo || "";
    form.elements.raza.value = pet?.raza || "";
    form.elements.sexo.value = pet?.sexo || "";
    form.elements.edad.value = pet?.edad ?? "";
    ownerSelect.value = pet?.idUsuario == null ? "" : String(pet.idUsuario);
    dialog.showModal();
  };

  const editPet = async (id) => {
    try {
      const pet = await request(`mascotas/${encodeURIComponent(id)}`);
      openForm(pet);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  const deletePet = async (pet) => {
    if (!window.confirm(`¿Deseas eliminar la mascota ${pet.nombre}?`)) return;
    try {
      await request(`mascotas/${encodeURIComponent(pet.idMascota)}`, { method: "DELETE" });
      showFeedback("Mascota eliminada correctamente.");
      await loadPets();
    } catch (error) {
      const relatedFailure = error.status === 409 || /foreign.?key|constraint|integrity|relacionad/i.test(error.message);
      showFeedback(relatedFailure
        ? "No se puede eliminar esta mascota porque tiene información relacionada."
        : error.message, true);
    }
  };

  document.querySelector("#newPetButton").addEventListener("click", () => {
    if (!clients.length) {
      showFeedback("No hay usuarios CLIENTE disponibles para asignar como propietario.", true);
      return;
    }
    openForm();
  });
  document.querySelector("#cancelPetButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const age = form.elements.edad.valueAsNumber;
    if (!Number.isInteger(age) || age < 0) {
      showFeedback("La edad debe ser un número entero igual o mayor que cero.", true);
      return;
    }
    if (!ownerSelect.value) {
      showFeedback("Selecciona un propietario.", true);
      return;
    }
    const payload = {
      idUsuario: Number(ownerSelect.value),
      nombre: form.elements.nombre.value.trim(),
      tipo: form.elements.tipo.value.trim(),
      raza: form.elements.raza.value.trim(),
      sexo: form.elements.sexo.value.trim(),
      edad: age
    };
    const isEditing = Boolean(editingId);
    try {
      await request(isEditing ? `mascotas/${encodeURIComponent(editingId)}` : "mascotas", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(isEditing ? "Mascota actualizada correctamente." : "Mascota registrada correctamente.");
      await loadPets();
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  loadPets(true);
})();
