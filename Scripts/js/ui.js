// ui.js - Global UI behaviors (Dropdowns, etc.)

/* ─── Global UI Helpers ──────────────────────────────────────────────────── */

function refreshTitle() {
  document.querySelectorAll(".player-title").forEach((el) => {
    const content = el.textContent.trim().toLowerCase();
    el.style.display = !content || content === "none" ? "none" : "";
  });
}

/* ─── Global UI Initializer ──────────────────────────────────────────────── */

const initGlobalUI = () => {
  const optionsButton = document.querySelector(".options");
  const dropdown = document.querySelector(".dropdown");

  // Toggle on button click; the stopPropagation prevents the document-level
  // click listener below from immediately closing it on the same event.
  optionsButton?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });

  // Close when clicking anywhere outside the dropdown. Only registered when
  // a dropdown exists — no point in a global listener on pages without one.
  if (dropdown) {
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) dropdown.classList.remove("show");
    });
  }
};

document.addEventListener("DOMContentLoaded", initGlobalUI);
