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
const fullNameInput = document.querySelector("#fullName");
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
      fullName: "Ingresa tu nombre completo.",
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

// Valida el registro y navega al inicio de sesión cuando todos los datos son correctos.
registerForm.addEventListener("submit", (event) => {
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

  window.location.href = "login.html";
});

// Recorre el arreglo de campos y registra los eventos comunes de validación.
[fullNameInput, emailInput, phoneInput, passwordInput, passwordConfirmationInput, termsInput]
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
