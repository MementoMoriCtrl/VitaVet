/* Validación local del formulario de registro de mascota. */
(() => {
  const form = document.querySelector("#petRegistrationForm");
  if (!form) return;

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
  const formMessage = document.querySelector("#petFormMessage");
  const submitButton = form.querySelector('button[type="submit"]');
  let isSubmitting = false;

  const showFormMessage = (message, includeLoginLink = false) => {
    if (!formMessage) return;
    formMessage.replaceChildren(document.createTextNode(message));
    if (includeLoginLink) {
      formMessage.append(" ");
      const loginLink = document.createElement("a");
      loginLink.href = "login.html";
      loginLink.textContent = "Volver al inicio de sesión";
      formMessage.append(loginLink);
    }
    formMessage.hidden = false;
  };

  const clearFieldError = (input) => {
    const error = document.getElementById(`${input.id}-error`);
    input.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  };

  const showFieldError = (input, message) => {
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", "true");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  };

  [...fields.map(([input]) => input), ageInput].forEach((input) => {
    input.addEventListener("input", () => {
      clearFieldError(input);
      if (formMessage) formMessage.hidden = true;
    });
    input.addEventListener("change", () => {
      clearFieldError(input);
      if (formMessage) formMessage.hidden = true;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (formMessage) formMessage.hidden = true;

    const errors = [];
    fields.forEach(([input, message]) => {
      clearFieldError(input);
      if (!input.value.trim()) errors.push([input, message]);
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
      errors.forEach(([input, message]) => showFieldError(input, message));
      errors[0][0].focus();
      return;
    }

    const token = sessionStorage.getItem("vitaVetToken");
    if (!token) {
      showFormMessage("Tu sesión no es válida.", true);
      return;
    }

    const payload = {
      nombre: form.elements.nombre.value.trim(),
      tipo: form.elements.tipo.value,
      raza: form.elements.raza.value.trim(),
      sexo: form.elements.sexo.value,
      edad: age
    };

    isSubmitting = true;
    if (submitButton) submitButton.disabled = true;

    let redirectAfterSuccess = false;
    fetch("http://localhost:8080/api/mascotas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(async (response) => {
        if (response.status !== 200) {
          const messages = {
            400: "No se pudieron registrar los datos enviados.",
            401: "Tu sesión no es válida.",
            403: "No tienes permisos para registrar mascotas.",
            500: "Ocurrió un error en el servidor. Inténtalo más tarde."
          };
          showFormMessage(messages[response.status] || "No se pudo registrar la mascota.", response.status === 401);
          return;
        }

        const createdPet = await response.json().catch(() => null);
        const registeredName = typeof createdPet?.nombre === "string"
          ? createdPet.nombre
          : payload.nombre;
        showFormMessage(`${registeredName} se registró correctamente. Volviendo a Mis mascotas.`);
        redirectAfterSuccess = true;
        window.setTimeout(() => {
          window.location.href = "mascotas.html";
        }, 900);
      })
      .catch(() => {
        showFormMessage("No se pudo conectar con el servidor. Inténtalo nuevamente.");
      })
      .finally(() => {
        if (!redirectAfterSuccess) {
          isSubmitting = false;
          if (submitButton) submitButton.disabled = false;
        }
      });
  });
})();
