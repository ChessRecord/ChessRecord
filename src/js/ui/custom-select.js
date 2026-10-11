/**
 * Replaces each native <select> inside a `.custom-select` wrapper with a styled
 * dropdown built from its <option>s. The <select> stays in the DOM (hidden) as the
 * source of truth, so the form still reads its value normally; the dropdown only ever
 * shows what the <select> currently has selected (see `sync` below).
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
    const doc = wrapper.ownerDocument;

    const selected = doc.createElement("div");
    selected.className = "select-selected";

    const items = doc.createElement("div");
    items.className = "select-items";
    items.append(
      ...Array.from(select.options)
        .slice(1)
        .map((option, i) => {
          const item = doc.createElement("div");
          item.dataset.index = String(i + 1);
          item.textContent = option.text;
          return item;
        }),
    );

    wrapper.append(selected, items);

    /** Show what the <select> has selected right now. */
    const sync = () => {
      const index = select.selectedIndex;
      selected.textContent = select.options[index]?.text ?? "";
      for (const item of items.children) {
        item.classList.toggle("same-as-selected", Number(item.dataset.index) === index);
      }
    };
    sync();

    items.addEventListener("click", ({ target }) => {
      const item = target.closest("[data-index]");
      if (!item) return;

      select.selectedIndex = Number(item.dataset.index);
      sync();
      setOpen(items, selected, false);
    });

    selected.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = items.classList.contains("select-show");
      closeAll();
      if (!wasOpen) setOpen(items, selected, true);
    });

    // A form reset changes the <select> behind this widget's back, and the "reset" event
    // fires BEFORE the controls are reset, so the select still holds the old value at that
    // moment. Look again once the reset has actually happened. Reading the live select
    // (rather than predicting what a reset will leave) also does the right thing when
    // another listener cancels the reset.
    select.form?.addEventListener("reset", () => setTimeout(sync, 0));
  });

  document.addEventListener("click", closeAll);
}
