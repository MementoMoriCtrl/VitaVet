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
const submitButton = loginForm.querySelector('[type="submit"]');
const API_LOGIN_URL = "http://localhost:8080/api/auth/login";
const SESSION_TOKEN_KEY = "vitaVetToken";
const SESSION_USER_KEY = "vitaVetUser";
let loginInProgress = false;

// Muestra un mensaje de información o validación en el formulario.
const setFormMessage = (message) => {
  formMessage.textContent = message;
};

const loginNotice = new URLSearchParams(window.location.search);
if (loginNotice.get("expired") === "1") {
  setFormMessage("Tu sesión expiró. Inicia sesión nuevamente.");
} else if (loginNotice.get("session") === "invalid") {
  setFormMessage("Inicia sesión para continuar.");
}

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
loginForm.addEventListener("submit", async (event) => {
  // Evita el envío tradicional para validar el formulario con JavaScript.
  event.preventDefault();
  setFormMessage("");

  // checkValidity usa las reglas HTML del formulario; reportValidity las muestra al usuario.
  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  if (loginInProgress) {
    return;
  }

  loginInProgress = true;
  submitButton.disabled = true;

  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);

    let response;
    try {
      response = await fetch(API_LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          correo: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });
    } catch (error) {
      setFormMessage("No se pudo conectar con el servidor. Verifica que VitaVet Backend esté ejecutándose.");
      return;
    }

    if (response.status === 401) {
      setFormMessage("El correo o la contraseña son incorrectos.");
      return;
    }

    if (!response.ok) {
      setFormMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
      return;
    }

    let user;
    try {
      user = await response.json();
    } catch (error) {
      setFormMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
      return;
    }
    if (!user.token || !["CLIENTE", "ADMIN"].includes(user.rol)) {
      setFormMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
      return;
    }

    const sessionUser = {
      idUsuario: user.idUsuario,
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      rol: user.rol,
    };

    sessionStorage.setItem(SESSION_TOKEN_KEY, user.token);
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(sessionUser));

    const dashboardByRole = {
      CLIENTE: "dashboard.html",
      ADMIN: "admin.html",
    };
    window.location.href = dashboardByRole[user.rol];
  } catch (error) {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    setFormMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
  } finally {
    loginInProgress = false;
    submitButton.disabled = false;
  }
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
