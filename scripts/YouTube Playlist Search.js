// ==UserScript==
// @name        YouTube Playlist Search
// @namespace   Violentmonkey Scripts
// @version     2.3.3
// @match       https://www.youtube.com/*
// @grant       none
// @run-at      document-idle
// @description YouTube playlist search with working recent searches and clear controls
// ==/UserScript==

(() => {
  "use strict";

  // Remove previous installation
  window.__ytPlaylistSearchCleanup?.();

  const HISTORY_KEY = "yt_playlist_recent_searches";
  const MAX_HISTORY = 5;

  let active = null;
  let scanTimer = null;

  const observers = new Map();

  // ==========================================
  // RECENT SEARCH STORAGE
  // ==========================================

  function getRecentSearches() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(HISTORY_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? saved
            .filter(item => typeof item === "string")
            .slice(0, MAX_HISTORY)
        : [];

    } catch (error) {
      console.warn("Could not read search history:", error);
      return [];
    }
  }

  function saveRecentSearch(query) {
    query = query.trim();

    if (!query) return;

    const searches = getRecentSearches();

    // Remove duplicates, ignoring capitalization
    const filtered = searches.filter(
      item => item.toLowerCase() !== query.toLowerCase()
    );

    // Add latest search at the beginning
    filtered.unshift(query);

    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(filtered.slice(0, MAX_HISTORY))
      );
    } catch (error) {
      console.warn("Could not save search:", error);
    }

    // Refresh UI through the active popup's own renderer
    active?.renderRecentSearches?.();
  }

  function clearRecentSearches() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.warn("Could not clear search history:", error);
    }

    // Correctly access the renderer belonging to this popup
    active?.renderRecentSearches?.();

    console.log("✅ Recent search history cleared.");
  }

  // ==========================================
  // SHADOW DOM DISCOVERY
  // ==========================================

  function discoverRoots() {
    const roots = [document];
    const visited = new Set();

    while (roots.length) {
      const root = roots.shift();

      if (visited.has(root)) continue;

      visited.add(root);

      root.querySelectorAll?.("*").forEach(el => {
        if (el.shadowRoot) {
          roots.push(el.shadowRoot);
        }
      });
    }

    return visited;
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  // ==========================================
  // FIND PLAYLIST POPUP
  // ==========================================

  function findPlaylist() {
    const candidates = [];

    for (const root of discoverRoots()) {
      root.querySelectorAll?.("yt-list-view-model")
        .forEach(list => {

          if (!isVisible(list)) return;

          const rows = [
            ...list.querySelectorAll(
              "yt-list-item-view-model"
            )
          ];

          if (rows.length > 0) {
            candidates.push({ list, rows });
          }
        });
    }

    candidates.sort(
      (a, b) => b.rows.length - a.rows.length
    );

    return candidates[0] || null;
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  function removeSearch() {
    if (!active) return;

    const current = active;

    // Save the current search before closing
    current.commitSearch();

    // Restore playlist visibility
    current.rows.forEach(row => {
      row.style.display =
        current.originalStyles.get(row) ?? "";
    });

    // Restore original dimensions
    current.list.style.minHeight =
      current.originalListMinHeight;

    current.parent.style.minHeight =
      current.originalParentMinHeight;

    current.bar.remove();

    active = null;
  }

  // ==========================================
  // INSTALL SEARCH UI
  // ==========================================

  function installSearch(list, rows) {

    const parent = list.parentElement;

    if (!parent) return;

    // Store original playlist styles
    const originalStyles = new Map();

    rows.forEach(row => {
      originalStyles.set(row, row.style.display);
    });

    // Preserve original dimensions
    const originalListHeight =
      list.getBoundingClientRect().height;

    const originalParentHeight =
      parent.getBoundingClientRect().height;

    const originalListMinHeight =
      list.style.minHeight;

    const originalParentMinHeight =
      parent.style.minHeight;

    // Prevent popup shrinking
    list.style.minHeight =
      `${originalListHeight}px`;

    parent.style.minHeight =
      `${originalParentHeight}px`;

    // Main container
    const bar = document.createElement("div");

    bar.id = "yt-playlist-search-custom";

    bar.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      background: #282828;
      position: relative;
      z-index: 999999;
      font-family: Roboto, Arial, sans-serif;
    `;

    // ========================================
    // SEARCH INPUT
    // ========================================

    const wrapper = document.createElement("div");

    wrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      background: #404040;
      border: 1px solid #666;
      border-radius: 24px;
      padding: 0 12px;
      box-sizing: border-box;
      width: 100%;
    `;

    const searchIcon = document.createElement("span");

    searchIcon.textContent = "⌕";

    searchIcon.style.cssText = `
      color: #aaa;
      font-size: 22px;
      flex-shrink: 0;
    `;

    const input = document.createElement("input");

    // Use text instead of search to avoid the browser's
    // additional native search-clear button.
    input.type = "text";
    input.placeholder = "Search your playlists...";
    input.autocomplete = "off";
    input.spellcheck = false;

    input.style.cssText = `
      flex: 1;
      min-width: 0;
      padding: 12px 0;
      border: none;
      background: transparent;
      color: white;
      font-size: 14px;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
    `;

    // Custom clear button
    const clear = document.createElement("button");

    clear.type = "button";
    clear.textContent = "×";
    clear.title = "Clear search";
    clear.setAttribute("aria-label", "Clear search");

    clear.style.cssText = `
      display: none;
      border: none;
      background: transparent;
      color: #aaa;
      font-size: 23px;
      cursor: pointer;
      padding: 2px 5px;
      line-height: 1;
      flex-shrink: 0;
    `;

    wrapper.append(searchIcon, input, clear);

    // ========================================
    // RECENT SEARCHES UI
    // ========================================

    const recentSection = document.createElement("div");

    recentSection.style.cssText = `
      display: none;
      padding: 10px 5px 3px;
    `;

    const recentHeader = document.createElement("div");

    recentHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 9px;
    `;

    const recentTitle = document.createElement("span");

    recentTitle.textContent = "Recent searches";

    recentTitle.style.cssText = `
      color: #aaa;
      font-size: 12px;
      font-weight: 500;
    `;

    const clearHistory = document.createElement("button");

    clearHistory.type = "button";
    clearHistory.textContent = "Clear history";

    clearHistory.style.cssText = `
      color: #aaa;
      font-size: 11px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 4px;
    `;

    const recentItems = document.createElement("div");

    recentItems.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    `;

    recentHeader.append(recentTitle, clearHistory);

    recentSection.append(recentHeader, recentItems);

    // ========================================
    // PLAYLIST COUNTER
    // ========================================

    const counter = document.createElement("div");

    counter.style.cssText = `
      color: #aaa;
      font-size: 11px;
      padding: 7px 5px 0;
      letter-spacing: 0.2px;
    `;

    bar.append(wrapper, recentSection, counter);

    parent.insertBefore(bar, list);

    // Active instance
    active = {
      list,
      rows,
      parent,
      bar,
      input,
      clear,
      counter,
      recentSection,
      recentItems,
      clearHistory,
      originalStyles,
      originalListMinHeight,
      originalParentMinHeight,
      commitSearch: () => {},
      renderRecentSearches: () => {}
    };

    // ========================================
    // EVENT PROPAGATION
    // ========================================

    // Stop events from reaching YouTube's menu handlers,
    // but only after the individual control handles them.
    [
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click",
      "keydown"
    ].forEach(type => {
      bar.addEventListener(type, event => {
        event.stopPropagation();
      });
    });

    // Prevent buttons from taking focus away from input
    // when clicked with a mouse.
    [
      clear,
      clearHistory
    ].forEach(button => {
      button.addEventListener("mousedown", event => {
        event.preventDefault();
      });
    });

    // ========================================
    // FILTER PLAYLISTS
    // ========================================

    function filterPlaylists() {

      const query = input.value.toLowerCase().trim();

      let count = 0;

      rows.forEach(row => {

        const name = (
          row.innerText || row.textContent || ""
        ).toLowerCase();

        const matches = name.includes(query);

        row.style.display = matches
          ? (originalStyles.get(row) || "")
          : "none";

        if (matches) count++;
      });

      // Update counter
      counter.textContent =
        `Showing ${count} of ${rows.length} playlists`;

      // Display clear button
      clear.style.display =
        query ? "block" : "none";

      // Hide history while searching
      recentSection.style.display =
        query ? "none" : "block";

      // Restore scrolling when search is empty
      if (!query) {

        list.scrollTop = 0;
        parent.scrollTop = 0;

        let element = parent.parentElement;

        while (
          element &&
          element !== document.body
        ) {
          if (
            element.scrollHeight > element.clientHeight
          ) {
            element.scrollTop = 0;
          }

          element = element.parentElement;
        }
      }
    }

    // LIVE SEARCH
    input.addEventListener("input", filterPlaylists);

    // ========================================
    // RENDER RECENT SEARCHES
    // ========================================

    function renderRecentSearches() {

      if (!active || active.bar !== bar) return;

      recentItems.replaceChildren();

      const searches = getRecentSearches();

      recentSection.style.display =
        input.value.trim() ? "none" : "block";

      if (searches.length === 0) {

        const empty = document.createElement("span");

        empty.textContent = "No recent searches";

        empty.style.cssText = `
          color: #777;
          font-size: 11px;
          padding: 3px 0;
        `;

        recentItems.appendChild(empty);

        clearHistory.style.display = "none";

        return;
      }

      clearHistory.style.display = "block";

      searches.forEach(query => {

        const chip = document.createElement("button");

        chip.type = "button";
        chip.textContent = query;
        chip.title = `Search for ${query}`;

        chip.style.cssText = `
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          background: #404040;
          color: #ddd;
          border: 1px solid #555;
          border-radius: 16px;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
        `;

        chip.addEventListener("mouseenter", () => {
          chip.style.background = "#555";
        });

        chip.addEventListener("mouseleave", () => {
          chip.style.background = "#404040";
        });

        // Prevent input blur and preserve the chip
        chip.addEventListener("mousedown", event => {
          event.preventDefault();
        });

        // Select a previous search
        chip.addEventListener("click", event => {

          event.preventDefault();
          event.stopPropagation();

          input.value = query;

          filterPlaylists();

          input.focus();

          console.log("Recent search selected:", query);
        });

        recentItems.appendChild(chip);
      });
    }

    // Expose renderer to storage functions
    active.renderRecentSearches = renderRecentSearches;

    // ========================================
    // SAVE SEARCH
    // ========================================

    function commitSearch() {

      const query = input.value.trim();

      if (query) {
        saveRecentSearch(query);
      }
    }

    active.commitSearch = commitSearch;

    // Save when pressing Enter
    input.addEventListener("keydown", event => {

      if (event.key === "Enter") {
        commitSearch();
      }

      if (event.key === "Escape") {

        input.value = "";

        filterPlaylists();

        input.focus();
      }
    });

    // ========================================
    // CLEAR SEARCH
    // ========================================

    clear.addEventListener("click", event => {

      event.preventDefault();
      event.stopPropagation();

      input.value = "";

      filterPlaylists();

      input.focus();

      console.log("✅ Search cleared.");
    });

    // ========================================
    // CLEAR HISTORY
    // ========================================

    clearHistory.addEventListener("click", event => {

      event.preventDefault();
      event.stopPropagation();

      clearRecentSearches();
    });

    // ========================================
    // INITIALISE
    // ========================================

    renderRecentSearches();

    filterPlaylists();

    input.focus();

    console.log("✅ YouTube Playlist Search v2.3.3 installed");
    console.log("Total playlists:", rows.length);
    console.log("Recent searches:", getRecentSearches());
  }

  // ==========================================
  // POPUP MONITORING
  // ==========================================

  function scan() {

    for (const root of discoverRoots()) {

      if (observers.has(root)) continue;

      const observer = new MutationObserver(scheduleScan);

      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "aria-hidden"
        ]
      });

      observers.set(root, observer);
    }

    // Check whether popup is still open
    if (active) {

      if (
        !active.list.isConnected ||
        !isVisible(active.list)
      ) {
        removeSearch();
      } else {
        return;
      }
    }

    // Find newly opened popup
    const result = findPlaylist();

    if (result) {
      installSearch(result.list, result.rows);
    }
  }

  // ==========================================
  // DEBOUNCE
  // ==========================================

  function scheduleScan() {

    if (scanTimer) return;

    scanTimer = setTimeout(() => {

      scanTimer = null;

      scan();

    }, 100);
  }

  // ==========================================
  // GLOBAL CLEANUP
  // ==========================================

  window.__ytPlaylistSearchCleanup = () => {

    removeSearch();

    observers.forEach(observer => {
      observer.disconnect();
    });

    observers.clear();

    if (scanTimer) {
      clearTimeout(scanTimer);
    }

    scanTimer = null;

    delete window.__ytPlaylistSearchCleanup;

    console.log("YouTube Playlist Search removed.");
  };

  // Start monitoring
  scan();

  console.log("👀 Monitoring YouTube Save to... popup");

})();
