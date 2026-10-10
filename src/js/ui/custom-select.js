/**
 * Replaces each native <select> inside a `.custom-select` wrapper with a styled
 * dropdown built from its <option>s. The <select> stays in the DOM (hidden) as the
 * source of truth, so the form still reads its value normally.
 *
 * The first option is treated as the placeholder: it is shown while selected but is
 * not offered in the list.
 */

/** Open or close one dropdown. */
function setOpen(items, selected, isOpen) {
  items.classList.toggle("select-show", isOpen);
  selected.classList.toggle("select-arrow-active", isOpen);
}

/**
 * @param {ParentNode} [root=document]
 */
export function initCustomSelects(root = document) {
  const wrappers = root.querySelectorAll(".custom-select");

  const closeAll = () => {
    wrappers.forEach((wrapper) => {
      setOpen(
        wrapper.querySelector(".select-items"),
        wrapper.querySelector(".select-selected"),
        false,
      );
    });
  };

  wrappers.forEach((wrapper) => {
    const select = wrapper.querySelector("select");

    const optionsHtml = Array.from(select.options)
      .slice(1)
      .map((option, i) => `<div data-index="${i + 1}">${option.text}</div>`)
      .join("");

    wrapper.insertAdjacentHTML(
      "beforeend",
      `
     <div class="select-selected">${select.options[select.selectedIndex].text}</div>
     <div class="select-items">${optionsHtml}</div>
    `,
    );

    const selected = wrapper.querySelector(".select-selected");
    const items = wrapper.querySelector(".select-items");

    items.addEventListener("click", ({ target }) => {
      const item = target.closest("[data-index]");
      if (!item) return;

      const index = Number(item.dataset.index);
      select.selectedIndex = index;
      selected.textContent = select.options[index].text;

      items.querySelector(".same-as-selected")?.classList.remove("same-as-selected");
      item.classList.add("same-as-selected");

      setOpen(items, selected, false);
    });

    selected.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = items.classList.contains("select-show");
      closeAll();
      if (!wasOpen) setOpen(items, selected, true);
    });
  });

  document.addEventListener("click", closeAll);
}
