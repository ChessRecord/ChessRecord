/**
 * select.js — Custom dropdown select component
 * Depends on: None
 *
 * Replaces every <select> inside a .custom-select wrapper with a styled,
 * accessible dropdown built from the original <option> elements. Uses event
 * delegation so a single listener handles every option click, and a global
 * outside-click handler closes any open dropdown.
 *
 * Exposed globals: none (auto-initializes on parse)
 */

"use strict";

(function () {
  document.querySelectorAll(".custom-select").forEach(initSelect);

  /**
   * Initialize a single custom-select wrapper: build the dropdown DOM,
   * then wire up the toggle and option-click handlers.
   *
   * @param {HTMLElement} wrapper - The .custom-select container
   * @returns {void}
   */
  function initSelect(wrapper) {
    const select = wrapper.querySelector("select");

    // Building the dropdown structure atomically via innerHTML is faster than
    // multiple createElement/appendChild cycles.
    const optionsHtml = Array.from(select.options)
      .slice(1)
      .map((opt, i) => `<div data-index="${i + 1}">${opt.text}</div>`)
      .join("");

    wrapper.insertAdjacentHTML(
      "beforeend",
      `
      <div class="select-selected">${select.options[select.selectedIndex].text}</div>
      <div class="select-items select-hide">${optionsHtml}</div>
    `,
    );

    const selected = wrapper.querySelector(".select-selected");
    const items = wrapper.querySelector(".select-items");

    // ── Delegate option clicks to the container ──────────────────────────
    items.addEventListener("click", ({ target }) => {
      const item = target.closest("[data-index]");
      if (!item) return;

      const index = Number(item.dataset.index);
      select.selectedIndex = index;
      selected.textContent = select.options[index].text;

      items
        .querySelector(".same-as-selected")
        ?.classList.remove("same-as-selected");
      item.classList.add("same-as-selected");

      close(items, selected);
    });

    // ── Toggle this dropdown open/closed ─────────────────────────────────
    selected.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !items.classList.contains("select-hide");
      closeAll();
      if (!isOpen) {
        items.classList.remove("select-hide");
        selected.classList.add("select-arrow-active");
      }
    });
  }

  /**
   * Close a single dropdown by hiding its items and deactivating the trigger.
   *
   * @param {HTMLElement} items - The .select-items container
   * @param {HTMLElement} selected - The .select-selected trigger element
   * @returns {void}
   */
  function close(items, selected) {
    items.classList.add("select-hide");
    selected.classList.remove("select-arrow-active");
  }

  /**
   * Close every open dropdown on the page. Called on outside-click and
   * before opening a new dropdown.
   *
   * @returns {void}
   */
  function closeAll() {
    document.querySelectorAll(".custom-select").forEach((wrapper) => {
      close(
        wrapper.querySelector(".select-items"),
        wrapper.querySelector(".select-selected"),
      );
    });
  }

  document.addEventListener("click", closeAll);
})();
