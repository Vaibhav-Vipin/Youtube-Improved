# YouTube Playlist Search
A lightweight [Violentmonkey](https://violentmonkey.github.io/) userscript that adds a search field and recent-search shortcuts to YouTube's **Save to...** playlist picker.
It is designed to make finding a playlist easier when saving a video, especially when your account has a large number of playlists.
> **Current version:** `2.3.3`  
> **Platform:** YouTube in a browser with Violentmonkey installed  
> **License:** MIT
## Features
- **Automatic popup detection** — watches the page for YouTube's Save to... playlist list and adds the search interface when the list is detected.
- **Live playlist filtering** — filters the detected playlist rows as you type.
- **Playlist counter** — displays the number of matching rows, for example, `Showing 4 of 79 playlists`.
- **Clear search** — the `×` control clears the current query and restores the list.
- **Recent searches** — keeps up to five unique search terms, with the newest term first.
- **Quick reuse** — select a recent-search chip to run that search again.
- **Clear history** — removes the saved recent-search terms.
- **Keyboard support** — press `Enter` to save the current query to recent searches; press `Escape` to clear the query.
- **Popup cleanup** — restores the playlist row display styles and the height styles modified by the script when the detected popup closes.
## Requirements
- A desktop browser supported by [Violentmonkey](https://violentmonkey.github.io/).
- Violentmonkey installed and enabled.
- YouTube opened on a video watch page (`https://www.youtube.com/watch...`).
## Installation
1. Install Violentmonkey in your browser.
2. Open the Violentmonkey dashboard.
3. Create a new script.
4. Replace the editor contents with the userscript from this repository (for example, `userscript/youtube-playlist-search.user.js`).
5. Save the script and make sure it is enabled.
6. Refresh the YouTube video page.
## How to use
1. Open a YouTube video.
2. Click **Save** to open YouTube's save menu.
3. Click **Save to...** to open the playlist picker.
4. When the playlist list is detected, the search interface is inserted above it.
5. Type part of a playlist name. Matching playlist rows remain visible while non-matching rows are hidden.
6. Select a recent-search chip to repeat a previous search.
### Search controls
| Control / action | Behaviour |
| --- | --- |
| Type in the search field | Filters playlist rows as you type. |
| `×` | Clears the current search query. |
| **Clear history** | Deletes the saved recent-search list. |
| Click a recent-search chip | Places that term in the search field and filters the playlists. |
| `Enter` | Saves the current non-empty query to recent searches. |
| `Escape` | Clears the current query. |
| Close the playlist picker | The current non-empty query is saved before the script removes its UI. |
## Recent-search storage and privacy
Recent searches are stored locally in the browser's YouTube site storage using `localStorage`.
- **Origin:** `https://www.youtube.com`
- **Storage key:** `yt_playlist_recent_searches`
- **Format:** JSON array of strings
- **Maximum entries:** 5
- **Ordering:** Most recently saved search first
- **Duplicates:** A repeated term is moved to the top; duplicate comparison ignores letter case.
The script does not send search terms to an external server. Recent searches are specific to the browser profile and are not automatically synchronized across devices. Clearing YouTube site data or browser storage may remove them.
To inspect the stored value, open the browser's Developer Tools console on YouTube and run:
```javascript
JSON.parse(
  localStorage.getItem("yt_playlist_recent_searches") || "[]"
);
```
To remove the stored history from the console, run:
```javascript
localStorage.removeItem("yt_playlist_recent_searches");
```
You can also use the **Clear history** control in the script's interface.
## Compatibility notes and limitations
- The userscript targets YouTube video watch pages, not every YouTube page.
- It looks for the playlist picker elements `yt-list-view-model` and `yt-list-item-view-model` in accessible (open) DOM and Shadow DOM roots. YouTube may change its page structure, which can require an update to the script.
- The counter reflects the playlist rows detected in the popup DOM at the time the script installs. It should not be interpreted as a guaranteed account-wide playlist total if YouTube changes how it loads or virtualizes playlist rows.
- Popup height preservation is best-effort. YouTube controls the outer dialog layout, so a future YouTube interface change may require adjustments.
- This is an independent community userscript. It is not affiliated with, endorsed by, or sponsored by YouTube or Google.
## Troubleshooting
### The search field does not appear
1. Confirm that Violentmonkey is enabled and this script is enabled.
2. Confirm that you are on a YouTube video watch page.
3. Refresh the page, then open **Save** → **Save to...**.
4. Check the browser console for errors. YouTube may have changed the playlist picker's DOM structure.
### Typing does not filter the playlists
Refresh YouTube and reopen the **Save to...** picker. If the problem continues, open the browser console and check for JavaScript errors. Include the error and your browser version when reporting an issue.
### Recent searches are missing
Recent searches are stored in YouTube's local storage for the current browser profile. They may be unavailable in another browser profile, private-browsing session, or after site data has been cleared.
### YouTube's interface changes
YouTube frequently updates its interface. If the picker stops being detected or filtering stops working after an update, open an issue with the browser name/version, a screenshot of the picker, and any relevant console error. Do not include cookies, authentication tokens, or other private account data.
## Development
The userscript is intentionally self-contained and uses standard browser JavaScript APIs. It has no external runtime dependencies and declares `@grant none` in its userscript metadata.
## License
This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
If you use the MIT license, replace the copyright placeholder in `LICENSE` with the name or GitHub username you want to publish under.
