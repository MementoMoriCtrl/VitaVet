const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");
const formMessage = document.querySelector("#loginFormMessage");
const visualImage = document.querySelector(".login-visual-image");

const setFormMessage = (message) => {
  formMessage.textContent = message;
};

const showValidationMessage = (input) => {
  if (input.validity.valueMissing) {
    setFormMessage(input === emailInput ? "Ingresa tu correo electrónico." : "Ingresa tu contraseña.");
    return;
  }

  if (input === emailInput && input.validity.typeMismatch) {
    setFormMessage("Ingresa un correo electrónico válido.");
  }
};

passwordToggle.addEventListener("click", () => {
  const isPasswordVisible = passwordInput.type === "text";

  passwordInput.type = isPasswordVisible ? "password" : "text";
  passwordToggle.setAttribute("aria-label", isPasswordVisible ? "Mostrar contraseña" : "Ocultar contraseña");
  passwordToggle.setAttribute("aria-pressed", String(!isPasswordVisible));
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setFormMessage("");

  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  window.location.href = "dashboard.html";
});

emailInput.addEventListener("input", () => setFormMessage(""));
passwordInput.addEventListener("input", () => setFormMessage(""));
emailInput.addEventListener("invalid", () => showValidationMessage(emailInput));
passwordInput.addEventListener("invalid", () => showValidationMessage(passwordInput));

visualImage.addEventListener("error", () => {
  visualImage.setAttribute("hidden", "");
});
