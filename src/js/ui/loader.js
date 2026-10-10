/**
 * Button loading state.
 *
 * Expects markup like
 *   <button><span>Label</span><div class="loader"></div></button>
 * `showLoader` swaps the label for "Loading" and reveals the spinner; `hideLoader`
 * restores the original label and hides it again.
 */

/** Original label HTML of buttons currently showing the loader. */
const savedLabels = new WeakMap();

const labelOf = (button) => button.querySelector("span");
const spinnerOf = (label) => label.parentElement?.querySelector(".loader");

/** @param {HTMLElement} button */
export function showLoader(button) {
  const label = labelOf(button);
  if (!label) return;

  // Keep the first label if the loader is shown twice in a row.
  if (!savedLabels.has(label)) savedLabels.set(label, label.innerHTML);

  const spinner = spinnerOf(label);
  if (spinner) spinner.style.display = "inline";

  label.innerHTML = "Loading";
}

/** @param {HTMLElement} button */
export function hideLoader(button) {
  const label = labelOf(button);
  if (!label) return;

  const spinner = spinnerOf(label);
  if (spinner) spinner.style.display = "none";

  if (savedLabels.has(label)) {
    label.innerHTML = savedLabels.get(label);
    savedLabels.delete(label);
  }
}
