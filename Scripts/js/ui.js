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

/* ─── Form Error Helpers ────────────────────────────────────────────────── */

function showFormError(targetForm, msg) {
  const form =
    typeof targetForm === "string"
      ? document.querySelector(targetForm)
      : targetForm;
  if (!form) return;

  let errorEl = form.querySelector(".form-error");
  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.className = "form-error";
    errorEl.setAttribute("role", "alert");
    // Standard position: before the submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.insertAdjacentElement("beforebegin", errorEl);
    } else {
      form.appendChild(errorEl);
    }
  }

  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function clearFormError(targetForm) {
  const form =
    typeof targetForm === "string"
      ? document.querySelector(targetForm)
      : targetForm;
  if (!form) return;

  const errorEl = form.querySelector(".form-error");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
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
