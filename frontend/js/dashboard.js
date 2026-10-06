/* Carga en el dashboard el nombre del usuario autenticado. */
(() => {
  const greeting = document.querySelector(".dashboard-intro .page-title");
  const userMenuName = document.querySelector(".dashboard-user-trigger span");
  const petsList = document.querySelector(".pets-list");
  const token = sessionStorage.getItem("vitaVetToken");

  if (!token) return;

  if (greeting && userMenuName) {
    fetch("http://localhost:8080/api/usuarios/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((user) => {
        if (!user || typeof user.nombre !== "string" || !user.nombre.trim()) return;

        const nombre = user.nombre.trim();
        const apellido = typeof user.apellido === "string" ? user.apellido.trim() : "";
        greeting.textContent = `Buenos días, ${nombre}`;
        if (apellido) userMenuName.textContent = `${nombre} ${apellido}`;
      })
      .catch(() => {
        // Si el backend no responde, se conservan los textos demo del dashboard.
      });
  }

  if (!petsList) return;

  const mascotaImages = {
    oliver: "../assets/images/mascotas/milo.jpg",
    snow: "../assets/images/mascotas/nala.jpg",
  };
  const fallbackImages = {
    gato: "../assets/images/mascotas/nala.jpg",
    default: "../assets/images/mascotas/milo.jpg",
  };
  const showEmptyPetsMessage = () => {
    const message = document.createElement("p");
    message.className = "pet-card-detail";
    message.textContent = "No tienes mascotas registradas.";
    petsList.replaceChildren(message);
  };

  fetch("http://localhost:8080/api/mascotas", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => {
      if (!response.ok) return null;
      return response.json();
    })
    .then((mascotas) => {
      if (!Array.isArray(mascotas)) return;

      const template = petsList.querySelector(".pet-card");
      if (!template) return;

      const mascotasValidas = mascotas.filter((mascota) =>
        mascota
        && typeof mascota.nombre === "string"
        && mascota.nombre.trim()
        && typeof mascota.tipo === "string"
        && typeof mascota.raza === "string"
        && mascota.edad !== undefined
        && mascota.edad !== null,
      );

      if (!mascotasValidas.length) {
        showEmptyPetsMessage();
        return;
      }

      const cards = mascotasValidas.map((mascota) => {
        const card = template.cloneNode(true);
        const name = card.querySelector(".pet-card-name");
        const detail = card.querySelector(".pet-card-detail");
        const image = card.querySelector(".pet-avatar-image");
        const normalizedName = mascota.nombre.trim().toLocaleLowerCase("es");
        const normalizedType = mascota.tipo.trim().toLocaleLowerCase("es");

        if (name) name.textContent = mascota.nombre.trim();
        if (detail) detail.textContent = `${mascota.tipo} · ${mascota.raza} · ${mascota.edad} años`;
        if (image) {
          image.src = mascotaImages[normalizedName]
            || fallbackImages[normalizedType]
            || fallbackImages.default;
          image.alt = `${mascota.nombre.trim()}, ${mascota.raza}`;
        }
        return card;
      });

      petsList.replaceChildren(...cards);
    })
    .catch(() => {
      // Si el backend no responde, se conserva la lista demo actual.
    });
})();
