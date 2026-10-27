/*
  Archivo: registro.js
  Propósito: valida el formulario de creación de cuenta y controla
  la visibilidad de las contraseñas.
*/

// =====================================================
// Elementos del formulario de registro
// =====================================================
// Guarda referencias a los campos y mensajes que serán usados por el formulario.
const registerForm = document.querySelector("#registerForm");
const nombreInput = document.querySelector("#nombre");
const apellidoInput = document.querySelector("#apellido");
const dniInput = document.querySelector("#dni");
const submitButton = registerForm.querySelector('[type="submit"]');
const API_REGISTRO_URL = "http://localhost:8080/api/auth/registro";
let registroEnCurso = false;
const emailInput = document.querySelector("#email");
const phoneInput = document.querySelector("#phone");
const passwordInput = document.querySelector("#password");
const passwordConfirmationInput = document.querySelector("#passwordConfirmation");
const termsInput = document.querySelector("#terms");
const formMessage = document.querySelector("#registerFormMessage");
const visualImage = document.querySelector(".login-visual-image");

// Actualiza el mensaje visible del formulario.
const setFormMessage = (message) => {
  formMessage.textContent = message;
};

// Cambia el tipo de un campo entre contraseña visible y contraseña oculta.
const togglePasswordVisibility = (input, button) => {
  const isPasswordVisible = input.type === "text";

  input.type = isPasswordVisible ? "password" : "text";
  button.setAttribute("aria-label", isPasswordVisible ? "Mostrar contraseña" : "Ocultar contraseña");
  button.setAttribute("aria-pressed", String(!isPasswordVisible));
};

// Revisa el campo indicado y muestra el mensaje correspondiente a su error.
const showValidationMessage = (input) => {
  if (input === termsInput && !termsInput.checked) {
    setFormMessage("Debes aceptar los términos y condiciones.");
    return;
  }

  if (input.validity.valueMissing) {
    const messages = {
      nombre: "Ingresa tu nombre.",
      apellido: "Ingresa tu apellido.",
      dni: "Ingresa tu DNI.",
      email: "Ingresa tu correo electrónico.",
      phone: "Ingresa tu teléfono.",
      password: "Ingresa una contraseña.",
      passwordConfirmation: "Confirma tu contraseña."
    };
    setFormMessage(messages[input.id]);
    return;
  }

  if (input === emailInput && input.validity.typeMismatch) {
    setFormMessage("Ingresa un correo electrónico válido.");
    return;
  }

  if (input === passwordInput && input.validity.tooShort) {
    setFormMessage("La contraseña debe tener al menos 8 caracteres.");
    return;
  }

  if (input.validity.customError) {
    setFormMessage(input.validationMessage);
  }
};

// Comprueba que la confirmación coincida con la contraseña original.
// setCustomValidity integra este resultado con la validación nativa del formulario.
const validatePasswordConfirmation = () => {
  passwordConfirmationInput.setCustomValidity(
    passwordConfirmationInput.value && passwordConfirmationInput.value !== passwordInput.value
      ? "Las contraseñas no coinciden."
      : ""
  );
};

const passwordToggle = document.querySelector("#passwordToggle");
const passwordConfirmationToggle = document.querySelector("#passwordConfirmationToggle");

// Registra los eventos de los botones que controlan la visibilidad de las contraseñas.
passwordToggle.addEventListener("click", () => {
  togglePasswordVisibility(passwordInput, passwordToggle);
});

passwordConfirmationToggle.addEventListener("click", () => {
  togglePasswordVisibility(passwordConfirmationInput, passwordConfirmationToggle);
});

// Envía el registro y navega al inicio de sesión solo tras confirmar su creación.
registerForm.addEventListener("submit", async (event) => {
  // Impide el envío tradicional para procesar las validaciones en el navegador.
  event.preventDefault();
  setFormMessage("");

  // Comprueba las reglas HTML, como campos obligatorios y formatos válidos.
  if (!registerForm.checkValidity()) {
    registerForm.reportValidity();
    return;
  }

  if (passwordInput.value !== passwordConfirmationInput.value) {
    setFormMessage("Las contraseñas no coinciden.");
    passwordConfirmationInput.focus();
    return;
  }

  if (!termsInput.checked) {
    setFormMessage("Debes aceptar los términos y condiciones.");
    termsInput.focus();
    return;
  }

  if (new TextEncoder().encode(passwordInput.value).length > 72) {
    setFormMessage("La contraseña no puede superar 72 bytes UTF-8; las tildes y emojis ocupan varios bytes.");
    return;
  }
  if (registroEnCurso) return;
  registroEnCurso = true;
  submitButton.disabled = true;
  try {
    let response;
    try {
      response = await fetch(API_REGISTRO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreInput.value.trim(),
          apellido: apellidoInput.value.trim(),
          dni: dniInput.value.trim(),
          correo: emailInput.value.trim(),
          telefono: phoneInput.value.trim(),
          password: passwordInput.value
        })
      });
    } catch {
      setFormMessage("No se pudo conectar con el servidor. Verifica que VitaVet Backend esté ejecutándose.");
      return;
    }
    if (response.status !== 201) {
      const messages = {
        400: "Revisa los campos y sus longitudes. Ingresa un correo válido.",
        409: "El DNI o correo ya está registrado.",
        401: "El servidor no permite el registro público. Contacta con soporte.",
        403: "El servidor no permite el registro público. Contacta con soporte."
      };
      let message = messages[response.status] || "No se pudo crear la cuenta. Inténtalo más tarde.";
      if ([400, 409].includes(response.status)) {
        try {
          const data = await response.json();
          if (typeof data.message === "string" && data.message.trim()) message = data.message;
        } catch { /* Mantener el mensaje según el estado HTTP. */ }
      }
      setFormMessage(message);
      return;
    }
    window.location.href = "login.html";
  } finally {
    registroEnCurso = false;
    submitButton.disabled = false;
  }
});

// Recorre el arreglo de campos y registra los eventos comunes de validación.
[nombreInput, apellidoInput, dniInput, emailInput, phoneInput, passwordInput, passwordConfirmationInput, termsInput]
  .forEach((input) => {
    input.addEventListener("input", () => setFormMessage(""));
    input.addEventListener("change", () => setFormMessage(""));
    input.addEventListener("invalid", () => showValidationMessage(input));
  });

// Actualiza la validación personalizada cada vez que cambia la confirmación.
passwordConfirmationInput.addEventListener("input", () => {
  validatePasswordConfirmation();
});

passwordInput.addEventListener("input", validatePasswordConfirmation);

// Oculta la imagen si el navegador informa que no pudo cargarla.
visualImage.addEventListener("error", () => {
  visualImage.setAttribute("hidden", "");
});
