import "./styles/app.css";

// Toggle del menú de navegación en móvil
const toggle = document.getElementById("nav-toggle");
const menu = document.getElementById("nav-menu");

toggle?.addEventListener("click", () => {
    const open = menu.classList.toggle("hidden") === false;
    menu.classList.toggle("flex", open);
    toggle.setAttribute("aria-expanded", String(open));
});
