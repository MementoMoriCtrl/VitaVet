/*
  Archivo: login.js
  Propósito: gestiona la validación y las interacciones del inicio de sesión.
*/

// =====================================================
// Elementos del formulario de inicio de sesión
// =====================================================
// querySelector obtiene referencias a los controles que serán manipulados
// mediante JavaScript durante la interacción del usuario.
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");
const formMessage = document.querySelector("#loginFormMessage");
const visualImage = document.querySelector(".login-visual-image");

// Muestra un mensaje de información o validación en el formulario.
const setFormMessage = (message) => {
  formMessage.textContent = message;
};

// Analiza el estado de validez de un campo y muestra el mensaje apropiado.
const showValidationMessage = (input) => {
  if (input.validity.valueMissing) {
    setFormMessage(input === emailInput ? "Ingresa tu correo electrónico." : "Ingresa tu contraseña.");
    return;
  }

  if (input === emailInput && input.validity.typeMismatch) {
    setFormMessage("Ingresa un correo electrónico válido.");
  }
};

// Alterna entre mostrar y ocultar la contraseña cuando el usuario pulsa el botón.
passwordToggle.addEventListener("click", () => {
  const isPasswordVisible = passwordInput.type === "text";

  passwordInput.type = isPasswordVisible ? "password" : "text";
  passwordToggle.setAttribute("aria-label", isPasswordVisible ? "Mostrar contraseña" : "Ocultar contraseña");
  passwordToggle.setAttribute("aria-pressed", String(!isPasswordVisible));
});

// Procesa el envío del formulario sin recargar la página.
loginForm.addEventListener("submit", (event) => {
  // Evita el envío tradicional para validar el formulario con JavaScript.
  event.preventDefault();
  setFormMessage("");

  // checkValidity usa las reglas HTML del formulario; reportValidity las muestra al usuario.
  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  window.location.href = "dashboard.html";
});

// Limpia el mensaje cuando el usuario vuelve a escribir o modifica un campo.
emailInput.addEventListener("input", () => setFormMessage(""));
passwordInput.addEventListener("input", () => setFormMessage(""));
emailInput.addEventListener("invalid", () => showValidationMessage(emailInput));
passwordInput.addEventListener("invalid", () => showValidationMessage(passwordInput));

// Oculta la imagen decorativa si el recurso no puede cargarse.
visualImage.addEventListener("error", () => {
  visualImage.setAttribute("hidden", "");
});
