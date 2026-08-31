const registerForm = document.querySelector("#registerForm");
const fullNameInput = document.querySelector("#fullName");
const emailInput = document.querySelector("#email");
const phoneInput = document.querySelector("#phone");
const passwordInput = document.querySelector("#password");
const passwordConfirmationInput = document.querySelector("#passwordConfirmation");
const termsInput = document.querySelector("#terms");
const formMessage = document.querySelector("#registerFormMessage");
const visualImage = document.querySelector(".login-visual-image");

const setFormMessage = (message) => {
  formMessage.textContent = message;
};

const togglePasswordVisibility = (input, button) => {
  const isPasswordVisible = input.type === "text";

  input.type = isPasswordVisible ? "password" : "text";
  button.setAttribute("aria-label", isPasswordVisible ? "Mostrar contraseña" : "Ocultar contraseña");
  button.setAttribute("aria-pressed", String(!isPasswordVisible));
};

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

const validatePasswordConfirmation = () => {
  passwordConfirmationInput.setCustomValidity(
    passwordConfirmationInput.value && passwordConfirmationInput.value !== passwordInput.value
      ? "Las contraseñas no coinciden."
      : ""
  );
};

const passwordToggle = document.querySelector("#passwordToggle");
const passwordConfirmationToggle = document.querySelector("#passwordConfirmationToggle");

passwordToggle.addEventListener("click", () => {
  togglePasswordVisibility(passwordInput, passwordToggle);
});

passwordConfirmationToggle.addEventListener("click", () => {
  togglePasswordVisibility(passwordConfirmationInput, passwordConfirmationToggle);
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setFormMessage("");

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

[fullNameInput, emailInput, phoneInput, passwordInput, passwordConfirmationInput, termsInput]
  .forEach((input) => {
    input.addEventListener("input", () => setFormMessage(""));
    input.addEventListener("change", () => setFormMessage(""));
    input.addEventListener("invalid", () => showValidationMessage(input));
  });

passwordConfirmationInput.addEventListener("input", () => {
  validatePasswordConfirmation();
});

passwordInput.addEventListener("input", validatePasswordConfirmation);

visualImage.addEventListener("error", () => {
  visualImage.setAttribute("hidden", "");
});
