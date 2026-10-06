/* Carga el listado real de mascotas para la vista Mis mascotas. */
(() => {
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

  const petsGrid = document.querySelector(".pets-grid");
  const token = sessionStorage.getItem("vitaVetToken");
  if (!petsGrid || !token) return;

  const cardTemplate = petsGrid.querySelector(".pet-profile-card");
  const addPetCard = petsGrid.querySelector(".add-pet-card");
  if (!cardTemplate || !addPetCard) return;

  const imageByName = {
    oliver: "../assets/images/mascotas/milo.jpg",
    snow: "../assets/images/mascotas/nala.jpg",
  };
  const fallbackImageByType = {
    gato: "../assets/images/mascotas/nala.jpg",
    default: "../assets/images/mascotas/milo.jpg",
  };

  const showEmptyState = () => {
    const message = document.createElement("p");
    message.className = "pet-profile-summary";
    message.textContent = "No tienes mascotas registradas.";
    petsGrid.replaceChildren(message, addPetCard);
  };

  const createPetCard = (pet) => {
    const card = cardTemplate.cloneNode(true);
    const name = typeof pet.nombre === "string" ? pet.nombre.trim() : "";
    const tipo = typeof pet.tipo === "string" ? pet.tipo.trim() : "";
    const raza = typeof pet.raza === "string" ? pet.raza.trim() : "";
    const image = card.querySelector(".pet-profile-image");
    const profileLink = card.querySelector(".pet-profile-action");

    card.querySelector(".pet-profile-name").textContent = name;
    card.querySelector(".pet-profile-summary").textContent = `${tipo} · ${raza}`;

    if (image) {
      const normalizedName = name.toLocaleLowerCase("es");
      const normalizedType = tipo.toLocaleLowerCase("es");
      image.src = imageByName[normalizedName]
        || fallbackImageByType[normalizedType]
        || fallbackImageByType.default;
      image.alt = `${name}, ${tipo} ${raza}`.trim();
    }

    card.querySelectorAll(".pet-profile-details > div").forEach((row) => {
      const label = row.querySelector(".pet-profile-detail-label")?.textContent.trim();
      const value = row.querySelector(".pet-profile-detail-value");
      if (label === "Estado") {
        row.hidden = true;
        return;
      }
      if (label === "Tipo" && value) value.textContent = tipo;
      if (label === "Raza" && value) value.textContent = raza;
      if (label === "Edad" && value) value.textContent = `${pet.edad} años`;
    });

    card.querySelector(".badge-success")?.setAttribute("hidden", "");
    card.querySelector(".pet-profile-care")?.setAttribute("hidden", "");

    if (profileLink) {
      if (pet.idMascota !== undefined && pet.idMascota !== null) {
        profileLink.setAttribute(
          "href",
          `perfil-mascota.html?mascota=${encodeURIComponent(pet.idMascota)}`
        );
      } else {
        profileLink.setAttribute("href", "#");
        profileLink.addEventListener("click", (event) => event.preventDefault());
      }
    }

    return card;
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
      if (mascotas.length === 0) {
        showEmptyState();
        return;
      }

      const cards = mascotas
        .filter((pet) => pet && typeof pet === "object")
        .map(createPetCard);

      if (cards.length > 0) petsGrid.replaceChildren(...cards, addPetCard);
    })
    .catch(() => {
      // Ante un error se conserva el listado demo como fallback.
    });
})();
