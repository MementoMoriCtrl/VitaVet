(() => {
  const dashboardUrl = "dashboard.html";
  const loginUrl = "login.html";
  const user = window.VitaVetAuth?.getCurrentUser?.();

  if (!user || user.rol !== "ADMIN") {
    window.location.replace(user ? dashboardUrl : loginUrl);
    return;
  }

  const token = sessionStorage.getItem("vitaVetToken");
  if (!token) {
    window.VitaVetAuth?.logout?.();
    window.location.replace(loginUrl);
    return;
  }

  const body = document.body;
  body.hidden = false;
  const requestedSection = new URLSearchParams(window.location.search).get("seccion");
  const activeSection = ["usuarios", "mascotas", "veterinarios", "servicios", "citas", "pagos"].includes(requestedSection) ? requestedSection : null;
  const usersView = activeSection === "usuarios";
  const petsView = activeSection === "mascotas";
  const veterinariansView = activeSection === "veterinarios";
  const servicesView = activeSection === "servicios";
  const appointmentsView = activeSection === "citas";
  const paymentsView = activeSection === "pagos";
  const dashboardContent = document.querySelector("#adminDashboardContent");
  const usersModule = document.querySelector("#adminUsersModule");
  const petsModule = document.querySelector("#adminPetsModule");
  const veterinariansModule = document.querySelector("#adminVeterinariansModule");
  const servicesModule = document.querySelector("#adminServicesModule");
  const appointmentsModule = document.querySelector("#adminAppointmentsModule");
  const paymentsModule = document.querySelector("#adminPaymentsModule");
  if (dashboardContent) dashboardContent.hidden = usersView || petsView || veterinariansView || servicesView || appointmentsView || paymentsView;
  if (usersModule) usersModule.hidden = !usersView;
  if (petsModule) petsModule.hidden = !petsView;
  if (veterinariansModule) veterinariansModule.hidden = !veterinariansView;
  if (servicesModule) servicesModule.hidden = !servicesView;
  if (appointmentsModule) appointmentsModule.hidden = !appointmentsView;
  if (paymentsModule) paymentsModule.hidden = !paymentsView;
  const moduleNav = activeSection
    ? document.querySelector(`[data-coming-soon="${{
      usuarios: "Usuarios",
      mascotas: "Mascotas",
      veterinarios: "Veterinarios",
      servicios: "Servicios",
      citas: "Citas",
      pagos: "Pagos"
    }[activeSection]}"]`)
    : null;
  if (moduleNav) {
    moduleNav.classList.add("is-active");
    moduleNav.setAttribute("aria-current", "page");
  }
  const dashboardNav = document.querySelector('.admin-nav-link[href="admin.html"]');
  if (dashboardNav && activeSection) {
    dashboardNav.classList.remove("is-active");
    dashboardNav.removeAttribute("aria-current");
  }
  const fullName = [user.nombre, user.apellido]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ");
  const nameElement = document.querySelector("#adminUserName");
  if (nameElement) nameElement.textContent = fullName || "Administrador";

  const menuToggle = document.querySelector("#adminMenuToggle");
  const sidebar = document.querySelector("#adminSidebar");
  menuToggle?.addEventListener("click", () => {
    const isOpen = sidebar?.classList.toggle("is-open") || false;
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });
  const accountMenu = document.querySelector("#adminAccountMenu");
  const accountMenuToggle = document.querySelector("#adminUserMenuToggle");
  const accountDropdown = document.querySelector("#adminUserDropdown");
  const closeAccountMenu = () => {
    if (!accountDropdown || !accountMenuToggle) return;
    accountDropdown.hidden = true;
    accountMenuToggle.setAttribute("aria-expanded", "false");
  };
  accountMenuToggle?.addEventListener("click", () => {
    const isExpanded = accountMenuToggle.getAttribute("aria-expanded") === "true";
    accountMenuToggle.setAttribute("aria-expanded", String(!isExpanded));
    if (accountDropdown) accountDropdown.hidden = isExpanded;
  });
  document.addEventListener("click", (event) => {
    if (accountMenu && !accountMenu.contains(event.target)) closeAccountMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && accountMenuToggle?.getAttribute("aria-expanded") === "true") {
      closeAccountMenu();
      accountMenuToggle.focus();
    }
  });
  document.querySelectorAll("[data-coming-soon]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (link.dataset.comingSoon === "Usuarios") {
        window.location.href = "admin.html?seccion=usuarios";
        return;
      }
      if (link.dataset.comingSoon === "Mascotas") {
        window.location.href = "admin.html?seccion=mascotas";
        return;
      }
      if (link.dataset.comingSoon === "Veterinarios") {
        window.location.href = "admin.html?seccion=veterinarios";
        return;
      }
      if (link.dataset.comingSoon === "Servicios") {
        window.location.href = "admin.html?seccion=servicios";
        return;
      }
      if (link.dataset.comingSoon === "Citas") {
        window.location.href = "admin.html?seccion=citas";
        return;
      }
      if (link.dataset.comingSoon === "Pagos") {
        window.location.href = "admin.html?seccion=pagos";
        return;
      }
      const feedback = document.querySelector("#adminFeedback");
      if (feedback) {
        feedback.classList.remove("is-error");
        feedback.textContent = `El módulo ${link.dataset.comingSoon} estará disponible próximamente.`;
        feedback.hidden = false;
      }
      sidebar?.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
      menuToggle?.setAttribute("aria-label", "Abrir menú");
    });
  });

  const endpoints = [
    ["usuarios", "countUsuarios"],
    ["mascotas", "countMascotas"],
    ["veterinarios", "countVeterinarios"],
    ["servicios", "countServicios"],
    ["citas", "countCitas"],
    ["pagos", "countPagos"]
  ];

  const showFeedback = (message, isError = false) => {
    const feedback = document.querySelector("#adminFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const getCollection = async (resource) => {
    const response = await fetch(`http://localhost:8080/api/${resource}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`Respuesta no válida: ${resource}`);
    return data;
  };

  const formatDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return "No disponible";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };

  const formatTime = (value) => {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!match) return "No disponible";
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      .format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
  };

  const dateTimeValue = (appointment) => {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(appointment.fecha || ""));
    const timeMatch = /^(\d{2}):(\d{2})/.exec(String(appointment.hora || ""));
    if (!dateMatch) return Number.NEGATIVE_INFINITY;
    return new Date(
      Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]),
      timeMatch ? Number(timeMatch[1]) : 0, timeMatch ? Number(timeMatch[2]) : 0
    ).getTime();
  };

  const showRecentMessage = (message) => {
    const bodyElement = document.querySelector("#adminRecentAppointments");
    if (!bodyElement) return;
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "admin-table-message";
    cell.textContent = message;
    row.append(cell);
    bodyElement.replaceChildren(row);
  };

  const renderRecentAppointments = (appointments, pets, services, veterinarians) => {
    const bodyElement = document.querySelector("#adminRecentAppointments");
    if (!bodyElement) return;
    if (!appointments.length) {
      showRecentMessage("No hay citas registradas.");
      return;
    }
    const petById = new Map(pets.map((pet) => [Number(pet.idMascota), pet]));
    const serviceById = new Map(services.map((service) => [Number(service.idServicio), service]));
    const vetById = new Map(veterinarians.map((vet) => [Number(vet.idVeterinario), vet]));
    const latest = [...appointments]
      .filter((appointment) => appointment && typeof appointment === "object")
      .sort((first, second) => dateTimeValue(second) - dateTimeValue(first))
      .slice(0, 6);
    const rows = latest.map((appointment) => {
      const pet = petById.get(Number(appointment.idMascota));
      const service = serviceById.get(Number(appointment.idServicio));
      const veterinarian = vetById.get(Number(appointment.idVeterinario));
      const veterinarianName = veterinarian
        ? [veterinarian.nombre, veterinarian.apellido].filter((part) => typeof part === "string" && part.trim()).join(" ")
        : "";
      const values = [
        pet?.nombre || "No disponible",
        service?.nombre || "No disponible",
        veterinarianName || "No disponible",
        formatDate(appointment.fecha),
        formatTime(appointment.hora),
        appointment.estado || "No disponible"
      ];
      const row = document.createElement("tr");
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
      return row;
    });
    bodyElement.replaceChildren(...rows);
  };

  const renderDashboard = async () => {
    const results = await Promise.allSettled(endpoints.map(([endpoint]) => getCollection(endpoint)));
    const data = {};
    const errors = [];
    let shouldLogout = false;
    results.forEach((result, index) => {
      const [endpoint, counterId] = endpoints[index];
      const counter = document.getElementById(counterId);
      if (result.status === "fulfilled") {
        data[endpoint] = result.value;
        if (counter) counter.textContent = String(result.value.length);
      } else {
        if (counter) counter.textContent = "—";
        const error = result.reason;
        if (error.status === 401) shouldLogout = true;
        errors.push(error);
      }
    });

    if (shouldLogout) {
      window.VitaVetAuth?.logout?.();
      return;
    }

    if (errors.length) {
      if (errors.some((error) => error.status === 403)) {
        showFeedback("Acceso no autorizado para consultar uno o más recursos.", true);
      } else if (errors.some((error) => error.status === 500)) {
        showFeedback("Ocurrió un error del servidor. Algunos datos no están disponibles.", true);
      } else if (errors.some((error) => error instanceof TypeError)) {
        showFeedback("No se pudo conectar con el servidor. Verifica que el backend esté activo.", true);
      } else {
        showFeedback("Algunos datos no están disponibles en este momento.", true);
      }
    }

    if (!Array.isArray(data.citas)) {
      showRecentMessage("No se pudieron cargar las citas recientes.");
      return;
    }
    if (![data.mascotas, data.servicios, data.veterinarios].every(Array.isArray)) {
      showRecentMessage("No se pudieron cargar los catálogos para resolver las citas.");
      return;
    }
    renderRecentAppointments(data.citas, data.mascotas, data.servicios, data.veterinarios);
  };

  if (!activeSection) renderDashboard();
})();
