# ♟️ ChessRecord

Welcome to **ChessRecord**, the ultimate web application for tracking, storing, and organizing your chess games—whether they're played online or over-the-board (OTB). Effortlessly manage your entire chess journey from a single, streamlined interface.

[Check it out here! 🚀](https://chessrecord.pages.dev/)

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

**ChessRecord** is a powerful, intuitive web application built with Vanilla **JavaScript, CSS, and HTML**. Designed to make it easy for you to document and organize your chess games, providing a convenient way to store and retrieve them whenever needed.

## ✨ Features

- **Record Games**: Store games from both OTB matches and online platforms.
- **Upload via Link**: Add games directly from Lichess, ChessGames, or any other platform you prefer.
- **Integrated Database**: Build your personal collection of games for easy reference and organization.
- **Efficient Organization**: Tag games, sort by date, players, or events for quick access.

## 🚀 Usage

1. Open the application in your web browser: [ChessRecord](https://ChessRecord.pages.dev/).
2. Enter game details such as player names, tournament name, date, etc.
3. Provide the link to your game to record it.
4. Add the game to your personal database and keep it organized.

## 🛠️ Development

ChessRecord is plain static files: there is no build step. The scripts are native ES modules, which browsers
only load over `http://`, so open the site through a local web server (such as Python's `python -m http.server`, `npx serve`, or VS Code Live Server) rather than directly from `file://`.

### Project structure

```
index.html  new.html  pairings.html   One HTML page per screen; each loads one module from src/js/pages/
assets/                               Favicon
src/css/                              Stylesheets (see "CSS" below)
src/js/
  pages/                              Entry points: create the store, wire features together, nothing else
  features/
    games-list/                       Home page: searchable list, delete, import/export, "/" shortcut
    new-game/                         New Game form: FIDE lookup, name suggestions, validation, saving
    pairings/                         Chess-Results page: fetching, parsing, table rendering
  ui/                                 Widgets shared between pages: modal, loader, dropdown, custom select, theme toggle
  storage/                            game-store (the one owner of the games), IndexedDB adapter, localStorage helpers
  formats/                            ChesSoup (.chr), PGN and the file-extension dispatcher
  domain/                             Pure chess/game rules: normalising games, sorting, results, time controls, Elo, players
  lib/                                Dependency-free helpers
```

### How the pieces fit together

Dependencies point one way only, down this list:

`pages` → `features/<name>` → `ui` · `storage` → `formats` → `domain` → `lib`

Features never import each other, nothing imports a page, and there are no import cycles and no globals
(the old `window.games` is now the `game-store` module). Dexie is the only third-party script module: the
HTML declares it in an import map, and it is loaded on demand so the app still works from `localStorage`
if it cannot be fetched.

### Data compatibility (do not change casually)

Existing users' data and exported files depend on these names and formats:

- **IndexedDB**: database `ChessRecord`, table `chessGames` (key `id`). The schema history lives in
  `src/js/storage/games-db.js`; never edit an existing `.version()` block, add a new one.
- **localStorage**: `chessGames` (copy of all games), `darkTheme`, `chessResultsUrl`.
  **sessionStorage**: `pairingsRounds`, `pairingsPlayerData`.
- **File formats**: `.chr` (ChesSoup, documented at the top of `src/js/formats/chessoup.js`), `.json` and `.pgn` import.
- **External services**: `https://lichess.org/api/fide/player` and the Chess-Results relay in `chess-results-client.js`.

### CSS

There is no bundler, so cascade order is expressed by the order of the `<link>` tags in each page, which is
always: `tokens` → `base` → `layout` → `components/*` → `features/*` → `components/modal` → `theme-dark`.
Media queries live next to the component they adjust.

## 🤝 Contributing

Suggestions and improvements are welcome via Pull Requests! Please note that this
project is released under a **custom All Rights Reserved license** — accepted
contributions become part of the project under that license.

1. **Open an issue** describing your suggestion or bug fix.
2. **Submit a Pull Request** with your proposed changes.
3. Accepted PRs will be merged at the maintainer's discretion.

## 📜 License

This website is licensed under a **custom All Rights Reserved license**.  
You may **view and use** the site for personal, non-commercial purposes, but  
**modifications, redistributions, forks, or rehosting are strictly prohibited**.  
Pull requests are welcome for suggestions only — accepted contributions become part of the project under this license.

---

Happy tracking and organizing your chess games! 🎉
