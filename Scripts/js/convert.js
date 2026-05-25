// convert.js - PGN to JSON converter page controller

window.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("PGN-Form");
  const textarea = document.getElementById("PGN");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const pgn = textarea.value.trim();
    if (!pgn) {
      alert("Please enter a PGN value.");
      return;
    }

    // Using pgnToJson from utils.js
    const json = pgnToJson(pgn);
    if (isEmpty(json)) {
      alert("No valid games found in PGN.");
      return;
    }

    const formatted = JSON.stringify(json, null, 2);

    // Extract event name for filename
    let eventName = (pgn.match(/\[Event "([^"]*)"\]/) || [, "chess_event"])[1];
    if (eventName.includes(":")) {
      eventName = eventName.substring(0, eventName.lastIndexOf(":")).trim();
    }
    eventName = eventName.replace(/[^a-z0-9\-_ ]/gi, "_");
    const filename = eventName + ".json";

    download(formatted, filename);
  });
});
