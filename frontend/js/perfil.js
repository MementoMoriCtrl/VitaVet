/* Presenta los perfiles de mascota demo y los datos reales del backend. */
(() => {
  const userProfileLayout = document.querySelector(".profile-layout");
  if (userProfileLayout) {
    const currentUser = window.VitaVetAuth?.getCurrentUser?.();
    const token = sessionStorage.getItem("vitaVetToken");
    const fullNameField = document.querySelector("#profileFullName");
    const emailField = document.querySelector("#profileEmail");
    const phoneField = document.querySelector("#profilePhone");
    const usernameField = document.querySelector("#profileUsername");
    const readData = document.querySelector("#profileReadData");
    const editForm = document.querySelector("#profileEditForm");
    const editMessage = document.querySelector("#profileEditMessage");
    const startEditButton = document.querySelector("#startProfileEdit");
    const cancelEditButton = document.querySelector("#cancelProfileEdit");
    const saveButton = document.querySelector("#saveProfileChanges");
    const fields = {
      nombre: document.querySelector("#profileEditName"),
      apellido: document.querySelector("#profileEditSurname"),
      correo: document.querySelector("#profileEditEmail"),
      telefono: document.querySelector("#profileEditPhone")
    };
    const message = document.querySelector(".profile-intro .page-subtitle");
    let profileData = null;
    let isSaving = false;
    const showError = (text) => {
      if (message) {
        message.textContent = text;
        message.setAttribute("role", "status");
      }
    };

    const showEditMessage = (text, includeLoginLink = false) => {
      if (!editMessage) return;
      editMessage.replaceChildren(document.createTextNode(text));
      if (includeLoginLink) {
        editMessage.append(" ");
        const loginLink = document.createElement("a");
        loginLink.href = "login.html";
        loginLink.textContent = "Volver al inicio de sesión";
        editMessage.append(loginLink);
      }
      editMessage.hidden = false;
    };

    const clearFieldError = (field) => {
      const error = document.querySelector(`#${field.id}Error`);
      field.removeAttribute("aria-invalid");
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }
    };

    const showFieldError = (field, text) => {
      const error = document.querySelector(`#${field.id}Error`);
      field.setAttribute("aria-invalid", "true");
      if (error) {
        error.textContent = text;
        error.hidden = false;
      }
    };

    const setEditMode = (editing) => {
      if (!readData || !editForm) return;
      readData.hidden = editing;
      editForm.hidden = !editing;
      startEditButton.hidden = editing;
      cancelEditButton.hidden = !editing;
      saveButton.hidden = !editing;
      if (editing && profileData) {
        fields.nombre.value = profileData.nombre;
        fields.apellido.value = profileData.apellido;
        fields.correo.value = profileData.correo;
        fields.telefono.value = profileData.telefono;
        fields.nombre.focus();
      }
    };

    const renderProfile = (user) => {
      profileData = {
        nombre: user.nombre.trim(),
        apellido: user.apellido.trim(),
        correo: user.correo.trim(),
        telefono: user.telefono.trim()
      };
      const fullName = `${profileData.nombre} ${profileData.apellido}`.trim();
      fullNameField.textContent = fullName || "No disponible";
      emailField.textContent = profileData.correo || "No disponible";
      phoneField.textContent = profileData.telefono || "No disponible";
      usernameField.textContent = fullName || "No disponible";
    };

    const updateNavbar = (user) => {
      const fullName = `${user.nombre} ${user.apellido}`.trim();
      document.querySelectorAll(".dashboard-user-trigger, .booking-user, .user-menu")
        .forEach((element) => {
          const nameElement = element.querySelector("span");
          if (nameElement) nameElement.textContent = fullName;

          if (element.classList.contains("dashboard-user-trigger")) {
            element.setAttribute("aria-label", `Abrir menú de ${fullName}`);
          } else if (/^Usuario(?:\s|$)/i.test(element.getAttribute("aria-label") || "")) {
            element.setAttribute("aria-label", `Usuario ${fullName}`);
          }
        });
    };

    if (!currentUser || !token) {
      showError("Tu sesiÃ³n no es vÃ¡lida. Inicia sesiÃ³n nuevamente.");
      return;
    }

    startEditButton.disabled = true;
    Object.values(fields).forEach((field) => {
      field.addEventListener("input", () => {
        clearFieldError(field);
        editMessage.hidden = true;
      });
    });

    startEditButton.addEventListener("click", () => {
      editMessage.hidden = true;
      setEditMode(true);
    });

    cancelEditButton.addEventListener("click", () => {
      Object.values(fields).forEach(clearFieldError);
      editMessage.hidden = true;
      setEditMode(false);
    });

    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (isSaving) return;
      editMessage.hidden = true;

      const values = Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [name, field.value.trim()])
      );
      const errors = [];
      Object.entries(fields).forEach(([name, field]) => {
        clearFieldError(field);
        if (!values[name]) {
          errors.push([field, "Este campo es obligatorio."]);
        } else if (values[name].length > Number(field.maxLength)) {
          errors.push([field, `No puede superar ${field.maxLength} caracteres.`]);
        } else if (name === "correo" && field.validity.typeMismatch) {
          errors.push([field, "Ingresa un correo electrónico válido."]);
        }
      });

      if (errors.length) {
        errors.forEach(([field, text]) => showFieldError(field, text));
        errors[0][0].focus();
        return;
      }

      const activeToken = sessionStorage.getItem("vitaVetToken");
      if (!activeToken) {
        showEditMessage("Tu sesión no es válida.", true);
        return;
      }

      const payload = {
        nombre: values.nombre,
        apellido: values.apellido,
        correo: values.correo,
        telefono: values.telefono
      };
      isSaving = true;
      saveButton.disabled = true;

      fetch("http://localhost:8080/api/usuarios/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify(payload)
      })
        .then(async (response) => {
          if (response.status !== 200) {
            const messages = {
              400: "Los datos ingresados no son válidos.",
              401: "Tu sesión ya no es válida.",
              403: "No tienes permisos para editar este perfil.",
              404: "No se encontró el usuario de esta sesión.",
              409: "Ese correo electrónico ya está en uso."
            };
            showEditMessage(
              messages[response.status] || "No se pudieron guardar los cambios.",
              response.status === 401
            );
            return;
          }

          const updatedUser = await response.json().catch(() => null);
          if (!updatedUser || Object.keys(fields).some((name) => typeof updatedUser[name] !== "string")) {
            throw new Error("invalid-response");
          }

          renderProfile(updatedUser);
          const storedUser = window.VitaVetAuth?.getCurrentUser?.() || currentUser;
          if (storedUser) {
            const updatedSessionUser = {
              ...storedUser,
              nombre: profileData.nombre,
              apellido: profileData.apellido,
              correo: profileData.correo,
              telefono: profileData.telefono
            };
            sessionStorage.setItem("vitaVetUser", JSON.stringify(updatedSessionUser));
            updateNavbar(updatedSessionUser);
          }

          setEditMode(false);
          showEditMessage("Tus datos se actualizaron correctamente.");
        })
        .catch((error) => {
          showEditMessage(error.message === "invalid-response"
            ? "No se pudo confirmar la actualización. Recarga el perfil para revisar tus datos."
            : "No se pudo conectar con el servidor. Inténtalo nuevamente.");
        })
        .finally(() => {
          isSaving = false;
          saveButton.disabled = false;
        });
    });

    fetch("http://localhost:8080/api/usuarios/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => {
        if (response.status === 401) throw new Error("unauthorized");
        if (response.status === 403) throw new Error("forbidden");
        if (response.status === 404) throw new Error("not-found");
        if (!response.ok) throw new Error("request-failed");
        return response.json();
      })
      .then((user) => {
        if (!user || typeof user.nombre !== "string" || typeof user.apellido !== "string"
          || typeof user.correo !== "string" || typeof user.telefono !== "string") {
          throw new Error("invalid-response");
        }

        renderProfile(user);
        startEditButton.disabled = false;
      })
      .catch((error) => {
        const messages = {
          unauthorized: "Tu sesiÃ³n ha expirado. Inicia sesiÃ³n nuevamente.",
          forbidden: "No tienes permiso para consultar tu perfil.",
          "not-found": "No se encontrÃ³ el usuario."
        };
        showError(messages[error.message] || "No se pudo conectar con el servidor.");
      });
    return;
  }

  const profileLayout = document.querySelector(".pet-detail-layout");
  if (!profileLayout) return;

  const profiles = {
    oliver: {
      name: "Oliver",
      image: "milo.jpg",
      type: "Perro",
      breed: "Golden Retriever",
      age: "4 años",
      status: "Saludable",
      alt: "Oliver, perro Golden Retriever"
    },
    snow: {
      name: "Snow",
      image: "nala.jpg",
      type: "Gato",
      breed: "Gata Persa",
      sex: "Hembra",
      age: "2 años",
      status: "Saludable",
      alt: "Snow, gata Persa"
    }
  };

  const params = new URLSearchParams(window.location.search);
  const requestedPet = params.get("mascota")?.toLowerCase();
  const title = document.querySelector(".pet-detail-intro .page-title");
  const name = document.querySelector(".pet-detail-name");
  const image = document.querySelector(".pet-detail-image");
  const summary = document.querySelector(".pet-detail-summary");
  const subtitle = document.querySelector(".pet-detail-intro .page-subtitle");

  const renderDemoProfile = (petKey) => {
    const pet = profiles[petKey];
    const isSnow = petKey === "snow";

    if (title) title.textContent = `Perfil de ${pet.name}`;
    if (name) name.textContent = pet.name;
    if (image) {
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = pet.alt;
    }
    if (summary) {
      summary.textContent = isSnow
        ? `${pet.breed} · ${pet.age}`
        : `${pet.type} · ${pet.breed} · ${pet.age}`;
    }
    document.title = `Perfil de ${pet.name} | VitaVet`;

    const valuesByLabel = {
      Tipo: pet.type,
      Raza: pet.breed,
      Sexo: pet.sex,
      Edad: pet.age,
      Estado: pet.status
    };
    profileLayout.querySelectorAll(".pet-detail-data-grid > div").forEach((row) => {
      const label = row.querySelector(".pet-detail-label")?.textContent.trim();
      const value = row.querySelector(".pet-detail-value");
      if (label === "Sexo" && isSnow) row.hidden = false;
      if (value && valuesByLabel[label]) value.textContent = valuesByLabel[label];
    });

    if (!isSnow) return;

    document.querySelector(".pet-appointment-card")?.setAttribute("hidden", "");
    document.querySelector(".pet-health-section")?.setAttribute("hidden", "");
    document.querySelector(".pet-history-section")?.setAttribute("hidden", "");

    const careCards = document.querySelectorAll(".pet-care-card");
    if (careCards[0]) {
      careCards[0].querySelector(".pet-care-label").textContent = "Vacunación anual";
      careCards[0].querySelector(".pet-care-name").textContent = pet.name;
      careCards[0].querySelector(".pet-care-date").textContent = "Octubre 2026";
    }
    careCards[1]?.setAttribute("hidden", "");
  };

  const showMessage = (message) => {
    if (subtitle) {
      subtitle.textContent = message;
      subtitle.setAttribute("role", "status");
    }
  };

  const hideUnsupportedDemoData = () => {
    profileLayout.querySelector(".pet-detail-card")?.setAttribute("hidden", "");
    profileLayout.querySelector(".badge-success")?.setAttribute("hidden", "");
    profileLayout.querySelectorAll(".pet-detail-data-grid > div").forEach((row) => {
      if (row.querySelector(".pet-detail-label")?.textContent.trim() === "Estado") {
        row.setAttribute("hidden", "");
      }
    });
    document.querySelector(".pet-appointment-card")?.setAttribute("hidden", "");
    document.querySelector(".pet-health-section")?.setAttribute("hidden", "");
    document.querySelector(".pet-care-section")?.setAttribute("hidden", "");
    document.querySelector(".pet-history-section")?.setAttribute("hidden", "");
  };

  const renderRealPet = (pet) => {
    if (!pet || typeof pet !== "object"
      || typeof pet.nombre !== "string"
      || typeof pet.tipo !== "string"
      || typeof pet.raza !== "string"
      || typeof pet.sexo !== "string"
      || typeof pet.edad !== "number") {
      showMessage("No fue posible cargar los datos de esta mascota.");
      return;
    }

    const age = `${pet.edad} años`;
    if (title) title.textContent = `Perfil de ${pet.nombre}`;
    if (name) name.textContent = pet.nombre;
    if (summary) summary.textContent = `${pet.tipo} · ${pet.raza} · ${age}`;
    if (image) {
      const normalizedType = pet.tipo.toLocaleLowerCase("es");
      image.src = normalizedType.includes("gato")
        ? "../assets/images/mascotas/nala.jpg"
        : "../assets/images/mascotas/milo.jpg";
      image.alt = `${pet.nombre}, ${pet.tipo} ${pet.raza}`.trim();
    }
    document.title = `Perfil de ${pet.nombre} | VitaVet`;

    const valuesByLabel = {
      Tipo: pet.tipo,
      Raza: pet.raza,
      Sexo: pet.sexo,
      Edad: age
    };
    profileLayout.querySelectorAll(".pet-detail-data-grid > div").forEach((row) => {
      const label = row.querySelector(".pet-detail-label")?.textContent.trim();
      const value = row.querySelector(".pet-detail-value");
      if (valuesByLabel[label] !== undefined && value) value.textContent = valuesByLabel[label];
    });
    profileLayout.querySelector(".pet-detail-card")?.removeAttribute("hidden");
    profileLayout.querySelector(".badge-success")?.style.setProperty("display", "none");
    const editButton = document.querySelector("#btnEditarMascota");
    if (editButton && /^\d+$/.test(requestedPet)) {
      editButton.addEventListener("click", () => {
        window.location.href = `editar-mascota.html?mascota=${encodeURIComponent(requestedPet)}`;
      });
    }
    showMessage("Información y seguimiento de tu mascota.");
  };

  // Sin parámetro conserva el perfil demo anterior; las claves demo existentes siguen funcionando.
  if (!requestedPet || profiles[requestedPet]) {
    renderDemoProfile(requestedPet || "oliver");
    return;
  }

  if (!/^\d+$/.test(requestedPet)) {
    hideUnsupportedDemoData();
    showMessage("No se encontró la mascota solicitada.");
    return;
  }

  hideUnsupportedDemoData();
  const token = sessionStorage.getItem("vitaVetToken");
  if (!token) {
    showMessage("No se pudo validar la sesión para consultar esta mascota.");
    return;
  }

  fetch(`http://localhost:8080/api/mascotas/${encodeURIComponent(requestedPet)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then((response) => {
      if (response.status === 404) throw new Error("not-found");
      if (response.status === 401 || response.status === 403) throw new Error("unauthorized");
      if (!response.ok) throw new Error("request-failed");
      return response.json();
    })
    .then(renderRealPet)
    .catch((error) => {
      if (error.message === "not-found") {
        showMessage("No se encontró la mascota solicitada.");
      } else if (error.message === "unauthorized") {
        showMessage("No tienes autorización para consultar esta mascota.");
      } else {
        showMessage("No fue posible conectar con el servicio para cargar la mascota.");
      }
    });
})();
