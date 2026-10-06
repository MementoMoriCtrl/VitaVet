/* Carga y valida localmente el formulario de edición de mascota. */
(() => {
  const form = document.querySelector("#editPetForm");
  if (!form) return;

  const message = document.querySelector("#editPetMessage");
  const cancelLink = document.querySelector("#cancelEditPet");
  const submitButton = form.querySelector('button[type="submit"]');
  const userMenuButton = document.querySelector(".dashboard-user-trigger");
  const userMenuText = userMenuButton?.querySelector("span");
  const currentUser = window.VitaVetAuth?.getCurrentUser?.();
  const fullName = [currentUser?.nombre, currentUser?.apellido]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ");

  if (fullName && userMenuText) {
    userMenuText.textContent = fullName;
    userMenuButton.setAttribute("aria-label", `Menú de usuario de ${fullName}`);
  }

  const fields = [
    [form.elements.nombre, "Ingresa el nombre de la mascota."],
    [form.elements.tipo, "Selecciona el tipo de mascota."],
    [form.elements.raza, "Ingresa la raza de la mascota."],
    [form.elements.sexo, "Selecciona el sexo de la mascota."]
  ];
  const ageInput = form.elements.edad;
  let petLoaded = false;
  let isSaving = false;
  const setMessage = (text) => {
    if (message) {
      message.textContent = text;
      message.hidden = !text;
    }
  };

  if (submitButton) submitButton.disabled = true;

  const queryId = new URLSearchParams(window.location.search).get("mascota");
  const numericId = Number(queryId);
  if (!queryId || !/^\d+$/.test(queryId) || !Number.isSafeInteger(numericId) || numericId <= 0) {
    setMessage("No se indicó un ID válido de mascota.");
    return;
  }

  const petId = String(numericId);
  if (cancelLink) cancelLink.href = `perfil-mascota.html?mascota=${encodeURIComponent(petId)}`;

  const token = sessionStorage.getItem("vitaVetToken");
  if (!token) {
    setMessage("La sesión no es válida. Inicia sesión para continuar.");
    return;
  }

  const clearFieldError = (input) => {
    const error = document.getElementById(`${input.id}-error`);
    input.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  };

  const showFieldError = (input, text) => {
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = text;
      error.hidden = false;
    }
  };

  const setFormEnabled = (enabled) => {
    [...fields.map(([input]) => input), ageInput].forEach((input) => {
      input.disabled = !enabled;
    });
    if (submitButton) submitButton.disabled = !enabled;
  };

  fetch(`http://localhost:8080/api/mascotas/${encodeURIComponent(petId)}`, {
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
    .then((pet) => {
      if (!pet || typeof pet !== "object"
        || typeof pet.nombre !== "string"
        || typeof pet.tipo !== "string"
        || typeof pet.raza !== "string"
        || typeof pet.sexo !== "string"
        || typeof pet.edad !== "number") {
        throw new Error("invalid-response");
      }

      form.elements.nombre.value = pet.nombre;
      form.elements.tipo.value = pet.tipo;
      form.elements.raza.value = pet.raza;
      form.elements.sexo.value = pet.sexo;
      ageInput.value = String(pet.edad);
      petLoaded = true;
      setFormEnabled(true);
      setMessage("");
    })
    .catch((error) => {
      const messages = {
        unauthorized: "La sesión no es válida. Inicia sesión nuevamente.",
        forbidden: "No tienes permisos para consultar esta mascota.",
        "not-found": "No se encontró la mascota solicitada.",
        "invalid-response": "No se pudieron cargar los datos de la mascota."
      };
      setMessage(messages[error.message] || "No se pudo conectar con el servidor.");
    });

  const clearErrorsAndMessage = (input) => {
    clearFieldError(input);
    setMessage("");
  };

  [...fields.map(([input]) => input), ageInput].forEach((input) => {
    input.addEventListener("input", () => clearErrorsAndMessage(input));
    input.addEventListener("change", () => clearErrorsAndMessage(input));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!petLoaded || isSaving) return;
    const errors = [];

    fields.forEach(([input, text]) => {
      clearFieldError(input);
      if (!input.value.trim()) errors.push([input, text]);
    });

    clearFieldError(ageInput);
    const ageValue = ageInput.value.trim();
    const age = Number(ageValue);
    if (!ageValue) {
      errors.push([ageInput, "Ingresa la edad de la mascota."]);
    } else if (!Number.isInteger(age) || age < 0) {
      errors.push([ageInput, "La edad debe ser un número entero igual o mayor que 0."]);
    }

    if (errors.length) {
      errors.forEach(([input, text]) => showFieldError(input, text));
      setMessage("Revisa los campos señalados.");
      errors[0][0].focus();
      return;
    }

    const payload = {
      nombre: form.elements.nombre.value.trim(),
      tipo: form.elements.tipo.value,
      raza: form.elements.raza.value.trim(),
      sexo: form.elements.sexo.value,
      edad: age
    };

    isSaving = true;
    if (submitButton) submitButton.disabled = true;

    let redirectAfterSuccess = false;
    fetch(`http://localhost:8080/api/mascotas/${encodeURIComponent(petId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (response.status === 200) {
          setMessage("Cambios guardados correctamente. Volviendo al perfil de la mascota.");
          redirectAfterSuccess = true;
          window.setTimeout(() => {
            window.location.href = `perfil-mascota.html?mascota=${encodeURIComponent(petId)}`;
          }, 900);
          return;
        }

        const messages = {
          400: "Los datos enviados no son válidos.",
          401: "La sesión ya no es válida.",
          403: "No tienes permisos para editar esta mascota.",
          404: "La mascota no existe o no pertenece a tu usuario.",
          500: "Ocurrió un error en el servidor. Inténtalo más tarde."
        };
        setMessage(messages[response.status] || "No se pudieron guardar los cambios.");

        if (response.status === 401 && message) {
          message.append(" ");
          const loginLink = document.createElement("a");
          loginLink.href = "login.html";
          loginLink.textContent = "Volver al inicio de sesión";
          message.append(loginLink);
        }
      })
      .catch(() => {
        setMessage("No se pudo conectar con el servidor. Inténtalo nuevamente.");
      })
      .finally(() => {
        if (!redirectAfterSuccess) {
          isSaving = false;
          if (submitButton) submitButton.disabled = false;
        }
      });
  });
})();
