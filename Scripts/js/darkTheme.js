/**
 * darkTheme.js — Dark theme toggle
 * Depends on: utils.js (Storage)
 *
 * Creates a fixed-position toggle button that switches the <body> between
 * light and dark themes. The user's preference is persisted in localStorage
 * and restored on every page load.
 *
 * Exposed globals: none (auto-initializes on DOMContentLoaded)
 */

"use strict";

class ThemeManager {
  /**
   * Create a ThemeManager instance. Caches a reference to the toggle button
   * element and sets up the DOMContentLoaded handler to initialize the UI.
   */
  constructor() {
    // Cache DOM reference
    this.themeToggleBtn = null;
    this.storage = Storage.proxy("darkTheme");

    // Initialize when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
      this.createThemeToggleButton();
      this.loadThemePreference();
    });
  }

  /**
   * Toggle between light and dark themes, persist the choice, and update
   * the toggle button color.
   *
   * @returns {void}
   */
  toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle("dark-theme");

    // Store preference
    this.storage.set(isDark);

    // Update appearance based on theme
    this.updateThemeAppearance(isDark);
  }

  /**
   * Read the stored theme preference and apply it to the document.
   *
   * @returns {void}
   */
  loadThemePreference() {
    const isDark = this.storage.get() === true;
    if (isDark) document.body.classList.add("dark-theme");

    // Update appearance based on theme
    this.updateThemeAppearance(isDark);
  }

  /**
   * Update the toggle button color to match the active theme.
   *
   * @param {boolean} isDark - Whether the dark theme is active
   * @returns {void}
   */
  updateThemeAppearance(isDark) {
    // Update button color
    if (this.themeToggleBtn) {
      this.themeToggleBtn.style.color = isDark
        ? "var(--white-primary)"
        : "var(--deep-blue)";
    }
  }

  /**
   * Create the fixed-position theme toggle button, style it, bind its
   * click handler, and append it to the document body.
   *
   * @returns {void}
   */
  createThemeToggleButton() {
    this.themeToggleBtn = document.createElement("button");
    this.themeToggleBtn.id = "theme-toggle-btn";
    this.themeToggleBtn.innerHTML =
      '<i class="fa-solid fa-circle-half-stroke"></i>';

    Object.assign(this.themeToggleBtn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "1000",
      backgroundColor: "transparent",
      border: "none",
      fontSize: "24px",
      cursor: "pointer",
    });

    // Bind this context to event handler
    this.themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    document.body.appendChild(this.themeToggleBtn);
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();
