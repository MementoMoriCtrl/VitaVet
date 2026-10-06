/* Protección de sesión y cierre de sesión para páginas privadas. */
(() => {
  const TOKEN_KEY = "vitaVetToken";
  const USER_KEY = "vitaVetUser";
  const LOGIN_URL = "login.html";

  const clearSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  const readUser = () => {
    try {
      const user = JSON.parse(sessionStorage.getItem(USER_KEY));
      if (!user || typeof user !== "object" || Array.isArray(user)) return null;
      const validId = (Number.isInteger(user.idUsuario) && user.idUsuario > 0)
        || (typeof user.idUsuario === "string" && user.idUsuario.trim() !== "");
      if (!validId) return null;
      if (!["CLIENTE", "ADMIN"].includes(user.rol)) return null;
      return user;
    } catch {
      return null;
    }
  };

  const readTokenPayload = (token) => {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(paddedBase64), (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  };

  const readValidSession = () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const user = readUser();
    if (!token) return { valid: false, expired: false };

    const payload = readTokenPayload(token);
    if (!payload || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return { valid: false, expired: false };
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, expired: true };
    }
    if (!user) return { valid: false, expired: false };

    return { valid: true, expired: false, token, user };
  };

  const validateSession = () => {
    const session = readValidSession();
    if (!session.valid) {
      clearSession();
      window.location.replace(session.expired ? `${LOGIN_URL}?expired=1` : `${LOGIN_URL}?session=invalid`);
      return false;
    }
    return true;
  };

  const getCurrentUser = () => validateSession() ? readUser() : null;

  const logout = (event) => {
    event?.preventDefault();
    clearSession();
    window.location.replace(LOGIN_URL);
  };

  window.VitaVetAuth = { getCurrentUser, logout, validateSession };

  if (!validateSession()) return;

  const bindLogoutControls = () => {
    document.querySelectorAll("#logoutButton, .dashboard-logout-item").forEach((element) => {
      element.addEventListener("click", logout);
    });
  };

  const updateUserNavbar = () => {
    const user = window.VitaVetAuth.getCurrentUser();
    if (!user) return;

    const fullName = [user.nombre, user.apellido]
      .filter((part) => typeof part === "string" && part.trim())
      .map((part) => part.trim())
      .join(" ");
    if (!fullName) return;

    document.querySelectorAll(".dashboard-user-trigger, .booking-user, .user-menu")
      .forEach((element) => {
        const nameElement = element.querySelector("span");
        if (nameElement) {
          nameElement.textContent = fullName;
        } else {
          const textNode = Array.from(element.childNodes)
            .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (textNode) textNode.textContent = fullName;
          else element.append(document.createTextNode(fullName));
        }

        const ariaLabel = element.getAttribute("aria-label");
        if (!ariaLabel) return;

        if (/^Abrir menú de(?:\s|$)/i.test(ariaLabel)) {
          element.setAttribute("aria-label", `Abrir menú de ${fullName}`);
        } else if (/^Ver perfil de(?:\s|$)/i.test(ariaLabel)) {
          element.setAttribute("aria-label", `Ver perfil de ${fullName}`);
        } else if (/^Usuario(?:\s|$)/i.test(ariaLabel)) {
          element.setAttribute("aria-label", `Usuario ${fullName}`);
        } else if (/^Menú de usuario(?:\s|$)/i.test(ariaLabel)) {
          element.setAttribute("aria-label", `Menú de usuario de ${fullName}`);
        }
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindLogoutControls();
      updateUserNavbar();
    }, { once: true });
  } else {
    bindLogoutControls();
    updateUserNavbar();
  }
})();
