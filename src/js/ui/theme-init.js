/**
 * Applies the saved light/dark theme before the page's first paint.
 *
 * Every page loads this as a plain, blocking <script> in <head>. It must NOT become a module:
 * module scripts are deferred, so the page would paint light first and flip to dark afterwards.
 * Being a classic script it cannot import anything, so it repeats the two names that
 * theme-toggle.js owns (the "darkTheme" localStorage key and the "dark-theme" class).
 * If either name changes, change it in both files.
 *
 * The class goes on <html> because <body> does not exist yet while <head> is being parsed.
 */
try {
  if (JSON.parse(localStorage.getItem("darkTheme")) === true) {
    document.documentElement.classList.add("dark-theme");
  }
} catch {
  // Storage blocked or the saved value unreadable: stay light.
}
