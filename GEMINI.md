# ChessRecord Engineering Standards

This document codifies the mandatory operating protocol and engineering standards for this project.

## 1. Operating Protocol
- **Research First:** Every task begins with a deep-dive research phase.
- **Mandatory Audit:** A detailed Technical Audit (architectural impact, performance, data integrity) must be presented before any coding.
- **Permission-Gated Execution:** NO code modification is permitted without explicit user authorization.
- **Surgical Edits:** Use `replace` and `write_file` with precision to maintain file integrity.

## 2. Engineering Standards
- **Performance:**
  - Prioritize batch DOM updates (e.g., string concatenation/innerHTML over repeated `createElement`).
  - Optimize storage I/O (IndexedDB/Dexie) by removing unused indexes and supporting incremental writes.
  - Use `Promise.all` for concurrent operations to minimize blocking time.
- **Data Integrity:**
  - Storage operations must be atomic and transaction-safe (Dexie `transaction`).
  - Always maintain a `localStorage` mirror as a fallback for IndexedDB.
- **UI/UX Consistency:**
  - Use `requestAnimationFrame` to ensure UI updates are painted before user-blocking alerts/dialogs.
  - Maintain consistent styling and responsive behavior.
- **Code Quality:**
  - Write high-signal, technical comments explaining the "why" behind complex logic.
  - Adhere strictly to existing project naming conventions and architecture.
