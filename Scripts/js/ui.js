// ui.js - Global UI behaviors (Dropdowns, etc.)

/* ─── Global UI Helpers ──────────────────────────────────────────────────── */

function refreshTitle() {
  document.querySelectorAll(".player-title").forEach((el) => {
    const content = el.textContent.trim().toLowerCase();
    el.style.display = !content || content === "none" ? "none" : "";
  });
}

function showLoader(target, message) {
  const el = document.querySelector(target);
  if (!el) return;

  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }

  // Look for a loader in the same container (e.g., inside the same button)
  const loader = el.parentElement?.querySelector(".loader");
  if (loader) loader.style.display = "inline";

  el.innerHTML = isValidString(message) ? message : "Loading";
}

function hideLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;

  const loader = el.parentElement?.querySelector(".loader");
  if (loader) loader.style.display = "none";

  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
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
