// modal.js

const Modal = (() => {
  // True while a modal is open. Prevents re-entrant open() calls from
  // clobbering the backdrop and leaking the in-flight Promise.
  let settled = true;

  function getBackdrop() {
    let el = document.getElementById("blur");
    if (!el) {
      el = document.createElement("div");
      el.id = "blur";
      el.className = "blur hidden";
      document.body.appendChild(el);
    }
    return el;
  }

  // Accepts raw HTML string. Resolves with the data-modal-action value, or null on dismiss.
  // Returns null immediately (without opening) if a modal is already open.
  function open(html) {
    if (!settled) return Promise.resolve(null);
    settled = false;

    return new Promise((resolve) => {
      const backdrop = getBackdrop();
      backdrop.innerHTML = html;
      backdrop.classList.remove("hidden");
      backdrop.classList.add("visible");

      const finish = (value) => {
        if (settled) return; // guard against race between click + keydown
        settled = true;
        backdrop.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeydown);
        backdrop.classList.remove("visible");
        backdrop.classList.add("hidden");
        backdrop.innerHTML = "";
        resolve(value);
      };

      const onClick = (e) => {
        if (e.target === backdrop) {
          finish(null);
          return;
        }
        const el = e.target.closest("[data-modal-action]");
        if (el)
          finish(
            el.dataset.modalAction === "cancel" ? null : el.dataset.modalAction,
          );
      };

      const onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      };

      backdrop.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  // Built-in confirmation dialog helper.
  // buttons: Array of { action, label, classes }
  function confirm({ icon = "", title = "", buttons = [] } = {}) {
    const iconHtml = icon ? `<i class="${icon}"></i>` : "";
    const buttonsHtml = buttons
      .map(
        ({ action, label, classes = "btn" }) =>
          `<button class="${classes}" data-modal-action="${action}">${label}</button>`,
      )
      .join("");
    return open(`
      <div class="confirmation">
        <div class="cancel" data-modal-action="cancel" title="Cancel">&times;</div>
        ${iconHtml}
        ${title ? `<h3>${title}</h3>` : ""}
        <div class="options">${buttonsHtml}</div>
      </div>`);
  }

  // Imperatively dismisses the current modal (e.g. after an async operation
  // completes). Also removes any lingering event listeners so nothing leaks
  // if hide() is called while open() is in-flight.
  function hide() {
    settled = true;
    const backdrop = getBackdrop();
    backdrop.classList.remove("visible");
    backdrop.classList.add("hidden");
    backdrop.innerHTML = "";
  }

  return { open, confirm, hide };
})();
