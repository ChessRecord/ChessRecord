// modal.js

const Modal = (() => {
  /** Flipped to false while a modal is open; guards against re-entrant open() calls. */
  let settled = true;

  /** The element focused before the modal opened — restored on every close path. */
  let prevFocus = null;

  /** Lazily created once and reused for every modal. */
  const backdrop = (() => {
    const el = document.createElement("div");
    el.id = "blur";
    el.className = "blur hidden";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
  })();

  /** Remove both listeners, restore focus, and resolve the in-flight Promise. */
  function teardown(resolve, value) {
    settled = true;
    backdrop.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    backdrop.classList.replace("visible", "hidden");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = "";
    prevFocus?.focus();
    prevFocus = null;
    resolve(value);
  }

  // Declared here so teardown can reference them by name for removeEventListener.
  let onClick, onKeydown;

  /**
   * Open a modal with arbitrary HTML content.
   * Resolves with the `data-modal-action` value of the clicked button,
   * or `null` on backdrop-click / Escape / cancel.
   * Returns `null` immediately if a modal is already open.
   *
   * @param {string} html
   * @returns {Promise<string|null>}
   */
  function open(html) {
    if (!settled) return Promise.resolve(null);
    settled = false;
    prevFocus = document.activeElement;

    return new Promise((resolve) => {
      backdrop.innerHTML = html;
      backdrop.classList.replace("hidden", "visible");
      backdrop.setAttribute("aria-hidden", "false");

      // Inject ARIA onto the dialog container so screen readers announce it correctly.
      const dialog = backdrop.firstElementChild;
      if (dialog) {
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        const heading = dialog.querySelector("h3");
        if (heading) {
          heading.id ||= "modal-title";
          dialog.setAttribute("aria-labelledby", "modal-title");
        }
      }

      // Move focus into the modal on open; return it to prevFocus on close.
      (backdrop.querySelector("button:not([disabled])") ?? dialog)?.focus();

      const finish = (value) => {
        if (settled) return; // race guard: click + keydown can both fire
        teardown(resolve, value);
      };

      onClick = (e) => {
        if (e.target === backdrop) return finish(null);

        const actionEl = e.target.closest("[data-modal-action]");
        if (!actionEl) return;

        const { modalAction: action, modalLoading: loading } = actionEl.dataset;

        if (action === "cancel") return finish(null);

        if (loading === "true") {
          // Ensure this button's loader has the magic ID showLoader expects.
          const loader = actionEl.querySelector(".loader");
          if (loader) loader.id = "loader";

          showLoader(`.confirmation [data-modal-action="${action}"] span`);

          actionEl
            .closest(".options")
            ?.querySelectorAll("button")
            .forEach((btn) => {
              if (btn !== actionEl) btn.style.display = "none";
            });

          backdrop
            .querySelector(".cancel")
            ?.style.setProperty("display", "none");

          // Remove interaction listeners — the modal stays open while the caller
          // awaits its async work, then drives close via hide(). settled is
          // intentionally left false here so no second modal can open while this
          // one is still visible; hide() will flip it back.
          backdrop.removeEventListener("click", onClick);
          document.removeEventListener("keydown", onKeydown);
          actionEl.disabled = true;
          resolve(action);
        } else {
          finish(action);
        }
      };

      onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      };

      backdrop.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  /**
   * Built-in confirmation dialog.
   *
   * @param {object}   opts
   * @param {string}  [opts.icon]    CSS class(es) for an <i> icon element.
   * @param {string}  [opts.title]   Dialog heading text.
   * @param {Array}   [opts.buttons] Array of { action, label, classes, loading }.
   * @returns {Promise<string|null>}
   */
  function confirm({ icon = "", title = "", buttons = [] } = {}) {
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

    return open(`
      <div class="confirmation">
        <div class="cancel" data-modal-action="cancel" title="Cancel" aria-label="Close dialog">&times;</div>
        ${iconHtml}
        ${titleHtml}
        <div class="options">${buttonsHtml}</div>
      </div>`);
  }

  /**
   * Imperatively dismiss the current modal — e.g. after an async operation
   * finishes inside a loading-button flow. Safe to call from a finally block
   * even if the modal closed through another path (settled will already be true).
   */
  function hide() {
    settled = true;
    backdrop.classList.replace("visible", "hidden");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = "";
    prevFocus?.focus();
    prevFocus = null;
  }

  return { open, confirm, hide };
})();
