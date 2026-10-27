const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const script = fs.readFileSync(path.join(__dirname, "../js/login.js"), "utf8");

function formulario(fetch) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      value: "dato", disabled: false, textContent: "", listeners: {},
      addEventListener(event, callback) { this.listeners[event] = callback; },
      setAttribute() {}, checkValidity() { return true; }, reportValidity() {},
      querySelector: element
    });
    return elements.get(selector);
  };
  const storage = new Map([["vitaVetToken", "token-anterior"], ["vitaVetUser", "usuario-anterior"]]);
  const window = { location: { href: "login.html", search: "" } };
  vm.runInNewContext(script, {
    document: { querySelector: element }, window, fetch, URLSearchParams,
    sessionStorage: { removeItem: (key) => storage.delete(key), setItem: (key, value) => storage.set(key, value) }
  });
  return { element, storage, window,
    submit: () => element("#loginForm").listeners.submit({ preventDefault() {} }) };
}

for (const message of [
  "Tu cuenta está pendiente de activación. No puedes iniciar sesión todavía.",
  "Tu cuenta no está activa. No puedes iniciar sesión. Contacta con administración."
]) {
  test(`403: ${message}`, async () => {
    const form = formulario(async () => ({ status: 403, ok: false, json: async () => ({ message }) }));
    await form.submit();
    assert.equal(form.window.location.href, "login.html");
    assert.equal(form.element("#loginFormMessage").textContent, message);
    assert.equal(form.storage.size, 0);
    assert.equal(form.element('[type="submit"]').disabled, false);
  });
}

test("401 muestra error genérico y elimina la sesión anterior", async () => {
  const form = formulario(async () => ({ status: 401, ok: false }));
  await form.submit();
  assert.match(form.element("#loginFormMessage").textContent, /incorrectos/);
  assert.equal(form.storage.size, 0);
  assert.equal(form.window.location.href, "login.html");
});

for (const [rol, destino] of [["CLIENTE", "dashboard.html"], ["ADMIN", "admin.html"]]) {
  test(`${rol} autenticado conserva sesión y destino`, async () => {
    const form = formulario(async () => ({ status: 200, ok: true,
      json: async () => ({ token: "jwt-valido", idUsuario: 8, rol }) }));
    await form.submit();
    assert.equal(form.storage.get("vitaVetToken"), "jwt-valido");
    assert.equal(JSON.parse(form.storage.get("vitaVetUser")).rol, rol);
    assert.equal(form.window.location.href, destino);
  });
}

test("403 sin JSON mantiene mensaje claro y no crea sesión", async () => {
  const form = formulario(async () => ({ status: 403, ok: false,
    json: async () => { throw new Error("sin JSON"); } }));
  await form.submit();
  assert.match(form.element("#loginFormMessage").textContent, /no está activa/);
  assert.equal(form.storage.size, 0);
  assert.equal(form.window.location.href, "login.html");
});
