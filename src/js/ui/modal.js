/**
 * Promise-based modal dialogs.
 *
 * One backdrop element (created on first use) is reused for every dialog. Only one
 * dialog can be open at a time; opening a second one resolves immediately with `null`.
 *
 * A button marked `loading: true` keeps the dialog open after it is clicked: the clicked
 * button shows the loader, the other buttons are hidden, and the caller closes the dialog
 * with `hideModal()` once its async work is done.
 */

import { hasValue } from "../lib/values.js";
import { showLoader } from "./loader.js";

/** False while a dialog is open; guards against re-entrant opens. */
let settled = true;

/** Element focused before the dialog opened, restored when it closes. */
let previousFocus = null;

/** @type {HTMLElement | null} */
let backdrop = null;

/** Handlers of the dialog currently open (kept so they can be removed again). */
let onClick;
let onKeydown;

function getBackdrop() {
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "modal-backdrop";
    backdrop.className = "modal-backdrop hidden";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }
  return backdrop;
}

/** Hide the backdrop, empty it and give focus back. */
function cleanup() {
  const el = getBackdrop();
  el.classList.replace("visible", "hidden");
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "";
  previousFocus?.focus();
  previousFocus = null;
}

/** Remove the listeners, close the dialog and resolve the pending promise. */
function teardown(resolve, value) {
  settled = true;
  getBackdrop().removeEventListener("click", onClick);
  document.removeEventListener("keydown", onKeydown);
  cleanup();
  resolve(value);
}

/**
 * Show arbitrary dialog HTML. Resolves with the `data-modal-action` of the clicked
 * button, or `null` for backdrop click, Escape or the close button.
 *
 * @param {string} html
 * @returns {Promise<string | null>}
 */
function openModal(html) {
  if (!settled) return Promise.resolve(null);
  settled = false;
  previousFocus = document.activeElement;
  const el = getBackdrop();

  return new Promise((resolve) => {
    el.innerHTML = html;
    el.classList.replace("hidden", "visible");
    el.setAttribute("aria-hidden", "false");

    // Describe the dialog to assistive technology.
    const dialog = el.firstElementChild;
    if (dialog) {
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      const heading = dialog.querySelector("h3");
      if (heading) {
        heading.id ||= "modal-title";
        dialog.setAttribute("aria-labelledby", "modal-title");
      }
    }

    // Move focus into the dialog; `cleanup()` hands it back.
    (el.querySelector("button:not([disabled])") ?? dialog)?.focus();

    const finish = (value) => {
      if (settled) return; // a click and a keydown can both arrive for one dismissal
      teardown(resolve, value);
    };

    onClick = (event) => {
      if (event.target === el) return finish(null);

      const actionEl = event.target.closest("[data-modal-action]");
      if (!actionEl) return;

      const { modalAction: action, modalLoading: loading } = actionEl.dataset;

      if (action === "cancel") return finish(null);

      if (loading === "true") {
        showLoader(actionEl);

        actionEl
          .closest(".modal-actions")
          ?.querySelectorAll("button")
          .forEach((button) => {
            if (button !== actionEl) button.style.display = "none";
          });

        el.querySelector(".modal-close")?.style.setProperty("display", "none");

        // Stop listening, but stay open: the caller is about to do async work and will
        // call hideModal(). `settled` stays false meanwhile so no second dialog can open
        // on top of this one.
        el.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        actionEl.disabled = true;
        resolve(action);
      } else {
        finish(action);
      }
    };

    onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };

    el.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

/**
 * Show a confirmation dialog.
 *
 * @param {Object} options
 * @param {string} [options.icon]   CSS classes for an <i> icon above the title
 * @param {string} [options.title]  Heading text
 * @param {Array<{ action: string, label: string, classes?: string, loading?: boolean }>} [options.buttons]
 * @returns {Promise<string | null>} The clicked button's `action`, or null when dismissed
 */
export function confirmDialog({ icon = "", title = "", buttons = [] } = {}) {
  const iconHtml = hasValue(icon) ? `<i class="${icon}"></i>` : "";
  const titleHtml = hasValue(title) ? `<h3>${title}</h3>` : "";
  const buttonsHtml = buttons
    .map(
      ({ action, label, classes = "btn", loading = false }) =>
        `<button class="${classes}" data-modal-action="${action}" data-modal-loading="${loading}">
            <span>${label}</span>
            ${loading ? '<div class="loader"></div>' : ""}
          </button>`,
    )
    .join("");

  return openModal(`
      <div class="modal">
        <div class="modal-close" data-modal-action="cancel" title="Cancel" aria-label="Close dialog">&times;</div>
        ${iconHtml}
        ${titleHtml}
        <div class="modal-actions">${buttonsHtml}</div>
      </div>`);
}

/**
 * Close the open dialog, for example after the async work of a loading button finished.
 * Safe to call from a `finally` block even if the dialog already closed.
 */
export function hideModal() {
  settled = true;
  cleanup();
}

/** True while a dialog is showing. */
export const isModalOpen = () => backdrop?.classList.contains("visible") ?? false;
