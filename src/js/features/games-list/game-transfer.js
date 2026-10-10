/**
 * Importing games from files and exporting them as a ChesSoup (.chr) download.
 * Owns every message shown to the user for those two flows.
 */

import { generateGameId } from "../../domain/game.js";
import { parseGameFile, toExportRecords } from "../../formats/game-file.js";
import { serializeChesSoup } from "../../formats/chessoup.js";
import { afterNextPaint } from "../../lib/dom.js";
import { downloadFile } from "../../lib/download.js";
import { isEmpty } from "../../lib/values.js";
import { confirmDialog, hideModal } from "../../ui/modal.js";

/** Export filenames use the date the page was opened. */
const todayStamp = new Date().toISOString().split("T")[0];

/* ─── Export ─────────────────────────────────────────────────────────────── */

/**
 * Download all games as `chessrecord-YYYY-MM-DD.chr`.
 * @param {import("../../domain/game.js").Game[]} games
 */
export function exportGames(games) {
  if (isEmpty(games)) {
    alert("Your game list is empty — there's nothing to export yet.");
    return;
  }
  try {
    const records = toExportRecords(games);
    if (isEmpty(records)) {
      alert("No valid games could be prepared for export.");
      return;
    }
    downloadFile(
      serializeChesSoup(records),
      `chessrecord-${todayStamp}.chr`,
      "application/octet-stream",
    );
  } catch (error) {
    console.error("Export failed:", error);
    alert("Export failed. Please try again.");
  }
}

/* ─── Import ─────────────────────────────────────────────────────────────── */

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Read and parse every selected file. Files are read concurrently; if any fails the
 * whole import is rejected.
 *
 * @param {FileList | File[]} files
 */
async function parseFiles(files) {
  const perFile = await Promise.all(
    Array.from(files).map(async (file) => parseGameFile(file.name, await readFileAsText(file))),
  );
  return perFile.flat();
}

/**
 * Put imported games into the store: straight in when the library is empty, otherwise
 * after asking whether to replace or merge.
 *
 * @param {import("../../domain/game.js").Game[]} imported
 * @param {{ store: ReturnType<typeof import("../../storage/game-store.js").createGameStore>, refresh: () => void }} deps
 */
async function applyImport(imported, { store, refresh }) {
  if (isEmpty(imported)) {
    return alert("The selected files didn't contain any recognisable games.");
  }
  if (imported.some((game) => !game.gameLink)) {
    return alert(
      "Some games are missing a required game link. Please check your files and try again.",
    );
  }

  const finalize = async (action) => {
    const label = isEmpty(store.games) ? "imported" : action === "replace" ? "replaced" : "merged";

    for (const game of imported) game.id = generateGameId();

    // The store updates and sorts its list synchronously, so re-rendering right away
    // shows the final order while the write is still in flight.
    let saving;
    if (action === "replace") saving = store.replaceAll(imported);
    else if (action === "merge") saving = store.merge(imported);
    else return;
    refresh();
    await saving;

    // Let the browser paint the new list before alert() blocks the page; otherwise the
    // user sees the old list behind the dialog.
    await afterNextPaint();
    alert(`Games ${label} successfully!`);
  };

  if (isEmpty(store.games)) {
    await finalize("replace");
    return;
  }

  const choice = await confirmDialog({
    icon: "fa-solid fa-triangle-exclamation modal-icon",
    title: "Do you want to replace or merge your games?",
    buttons: [
      { action: "replace", label: "Replace", classes: "btn outline", loading: true },
      { action: "merge", label: "Merge", classes: "btn", loading: true },
    ],
  });
  if (choice) {
    try {
      await finalize(choice);
    } finally {
      hideModal();
    }
  }
}

/**
 * `change` handler for the hidden file input.
 *
 * @param {Event} event
 * @param {Parameters<typeof applyImport>[1]} deps
 */
export async function handleImportEvent(event, deps) {
  const input = event.target;
  if (isEmpty(input.files)) return;

  try {
    await applyImport(await parseFiles(input.files), deps);
  } catch (error) {
    alert(
      error.message ||
        "Something went wrong while reading your files. Please check that they're valid and try again.",
    );
  } finally {
    input.value = "";
  }
}
