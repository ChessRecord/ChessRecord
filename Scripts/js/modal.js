// modal.js

const Modal = (() => {
  /** Flipped to false while a modal is open; guards against re-entrant open() calls. */
  let settled = true;

  /** Lazily created once and reused for every modal. */
  const backdrop = (() => {
    const el = document.createElement("div");
    el.id = "blur";
    el.className = "blur hidden";
    document.body.appendChild(el);
    return el;
  })();

  /** Remove both listeners and resolve the in-flight Promise. */
  function teardown(resolve, value) {
    settled = true;
    backdrop.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    backdrop.classList.replace("visible", "hidden");
    backdrop.innerHTML = "";
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

    return new Promise((resolve) => {
      backdrop.innerHTML = html;
      backdrop.classList.replace("hidden", "visible");

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

          // Resolve immediately without hiding — caller drives the close via hide().
          settled = true;
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
        <div class="cancel" data-modal-action="cancel" title="Cancel">&times;</div>
        ${iconHtml}
        ${titleHtml}
        <div class="options">${buttonsHtml}</div>
      </div>`);
  }

  /**
   * Imperatively dismiss the current modal — e.g. after an async operation
   * finishes inside a loading-button flow.
   */
  function hide() {
    settled = true;
    backdrop.classList.replace("visible", "hidden");
    backdrop.innerHTML = "";
  }

  return { open, confirm, hide };
})();
