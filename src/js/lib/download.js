/**
 * Trigger a browser download of `content` as `filename`.
 *
 * Browsers click a detached anchor without it being attached to the DOM.
 *
 * @param {BlobPart} content
 * @param {string} filename
 * @param {string} [contentType]
 * @returns {boolean} true when the download was started
 */
export function downloadFile(content, filename, contentType = "application/json") {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: contentType }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    return false;
  }
}
