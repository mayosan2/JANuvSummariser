// Content script is injected on demand; keep it upgrade-safe across reinjections.
if (window.__geminiSummarizerInitialized) {
  (function upgradeGeminiSummarizerUi() {
    const styleId = "yt-gemini-panel-style-upgrade";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #yt-gemini-panel-save {
          border: none;
          background: rgba(255, 255, 255, 0.06);
          color: #f5f5f5;
          border-radius: 999px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        #yt-gemini-panel-save:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        #yt-gemini-panel-header {
          justify-content: flex-start;
        }

        #yt-gemini-panel-title {
          flex: 1;
          min-width: 0;
        }
      `;
      document.head.appendChild(style);
    }

    function ensureSaveButton() {
      const panel = document.getElementById("yt-gemini-panel");
      if (!panel) return null;

      const header = panel.querySelector("#yt-gemini-panel-header");
      if (!header) return null;

      let saveBtn = header.querySelector("#yt-gemini-panel-save");
      if (saveBtn) return saveBtn;

      const closeBtn = header.querySelector("#yt-gemini-panel-close");

      saveBtn = document.createElement("button");
      saveBtn.id = "yt-gemini-panel-save";
      saveBtn.type = "button";
      saveBtn.textContent = "Uložit shrnutí";
      saveBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "YT_GEMINI_SAVE_LAST_SUMMARY" });
      });

      if (closeBtn && closeBtn.parentElement === header) {
        header.insertBefore(saveBtn, closeBtn);
      } else {
        header.appendChild(saveBtn);
      }

      return saveBtn;
    }

    function setSaveVisible(visible) {
      const btn = ensureSaveButton();
      if (btn) {
        btn.style.display = visible ? "inline-flex" : "none";
        btn.disabled = !visible;
      }
    }

    // If panel exists, inject button immediately (hidden by default).
    setSaveVisible(false);

    if (!window.__geminiSummarizerUpgradeListenerInstalled) {
      window.__geminiSummarizerUpgradeListenerInstalled = true;
      chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === "YT_GEMINI_SUMMARY_READY") {
          if (typeof message.summary === "string" && message.summary.trim()) {
            window.__geminiSummarizerLastSummary = message.summary;
          }
          setSaveVisible(true);
          return;
        }

        if (message?.type === "YT_GEMINI_SUMMARY_ERROR") {
          setSaveVisible(false);
          return;
        }

        if (message?.type === "YT_GEMINI_SUMMARY_SAVED") {
          setSaveVisible(false);
          return;
        }
      });
    }
  })();
} else {
  window.__geminiSummarizerInitialized = true;

  // --- UI: styl pro panel ---
  function ensureGeminiStyles() {
    if (document.getElementById("yt-gemini-panel-style")) return;

    const style = document.createElement("style");
    style.id = "yt-gemini-panel-style";
    style.textContent = `
      #yt-gemini-panel {
        position: fixed;
        top: 80px;
        right: 16px;
        width: 360px;
        max-height: 70vh;
        padding: 16px 18px 18px;
        box-sizing: border-box;
        background: rgba(15, 15, 15, 0.88);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow:
          0 22px 45px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(0, 0, 0, 0.6);
        color: #f5f5f5;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.5;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      #yt-gemini-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      #yt-gemini-panel-title {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.02em;
      }

      #yt-gemini-panel-close,
      #yt-gemini-panel-save {
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: #f5f5f5;
        border-radius: 999px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      #yt-gemini-panel-close:hover,
      #yt-gemini-panel-save:hover {
        background: rgba(255, 255, 255, 0.14);
      }

      #yt-gemini-panel-content {
        overflow: auto;
        padding-right: 2px;
      }

      #yt-gemini-panel-content ul {
        padding-left: 18px;
        margin: 0;
      }

      #yt-gemini-panel-content li {
        margin-bottom: 4px;
      }

      #yt-gemini-panel-footer {
        font-size: 11px;
        color: #a0a0a0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 6px;
        margin-top: 2px;
      }

      #yt-gemini-panel-source {
        opacity: 0.8;
      }

      .yt-gemini-spinner {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.12);
        border-top-color: #7dd3fc;
        animation: yt-gemini-spin 0.9s linear infinite;
        margin-right: 8px;
        flex-shrink: 0;
      }

      .yt-gemini-loading-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .yt-gemini-error {
        color: #fca5a5;
        white-space: pre-wrap;
      }

      .yt-gemini-pre {
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      @keyframes yt-gemini-spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 768px) {
        #yt-gemini-panel {
          width: calc(100vw - 32px);
          left: 16px;
          right: 16px;
          top: auto;
          bottom: 20px;
          max-height: 60vh;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // --- UI: vytvoření / aktualizace panelu ---
  function showGeminiPanel({ summary, isLoading, error, source, allowSave }) {
    ensureGeminiStyles();

    let panel = document.getElementById("yt-gemini-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "yt-gemini-panel";

      const header = document.createElement("div");
      header.id = "yt-gemini-panel-header";

      const title = document.createElement("div");
      title.id = "yt-gemini-panel-title";
      title.textContent = "Gemini – Shrnutí videa";

      const saveBtn = document.createElement("button");
      saveBtn.id = "yt-gemini-panel-save";
      saveBtn.textContent = "Uložit shrnutí";
      saveBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "YT_GEMINI_SAVE_LAST_SUMMARY" });
      });

      const closeBtn = document.createElement("button");
      closeBtn.id = "yt-gemini-panel-close";
      closeBtn.innerHTML = "Zavřít ✕";
      closeBtn.addEventListener("click", () => {
        panel.remove();
      });

      header.appendChild(title);
      header.appendChild(saveBtn);
      header.appendChild(closeBtn);

      const content = document.createElement("div");
      content.id = "yt-gemini-panel-content";

      const footer = document.createElement("div");
      footer.id = "yt-gemini-panel-footer";

      const srcSpan = document.createElement("span");
      srcSpan.id = "yt-gemini-panel-source";

      const brandSpan = document.createElement("span");
      brandSpan.textContent = "Google Gemini 1.5 Flash";

      footer.appendChild(srcSpan);
      footer.appendChild(brandSpan);

      panel.appendChild(header);
      panel.appendChild(content);
      panel.appendChild(footer);

      document.body.appendChild(panel);
    }

    const contentEl = panel.querySelector("#yt-gemini-panel-content");
    const srcSpan = panel.querySelector("#yt-gemini-panel-source");
    const saveBtn = panel.querySelector("#yt-gemini-panel-save");

    contentEl.innerHTML = "";

    if (isLoading) {
      const row = document.createElement("div");
      row.className = "yt-gemini-loading-row";

      const spinner = document.createElement("div");
      spinner.className = "yt-gemini-spinner";

      const text = document.createElement("div");
      text.textContent = "Generuji shrnutí videa…";

      row.appendChild(spinner);
      row.appendChild(text);
      contentEl.appendChild(row);
    } else if (error) {
      const errDiv = document.createElement("div");
      errDiv.className = "yt-gemini-error";
      errDiv.textContent = error;
      contentEl.appendChild(errDiv);
    } else if (summary) {
      const pre = document.createElement("div");
      pre.className = "yt-gemini-pre";
      pre.textContent = summary;
      contentEl.appendChild(pre);
    } else {
      const empty = document.createElement("div");
      empty.textContent = "Žádný obsah k zobrazení.";
      contentEl.appendChild(empty);
    }

    srcSpan.textContent =
      source === "captions"
        ? "Zdroj: titulky videa"
        : source === "metadata"
        ? "Zdroj: metadata stránky"
        : "";

    if (saveBtn) {
      saveBtn.style.display = allowSave ? "inline-flex" : "none";
    }

    if (typeof summary === "string" && summary.trim()) {
      window.__geminiSummarizerLastSummary = summary;
    }
  }

  // --- YouTube: získání playerResponse / titulků / metadat ---

  function getYtInitialPlayerResponse() {
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }

    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const text = s.textContent || "";
      const idx = text.indexOf("ytInitialPlayerResponse");
      if (idx === -1) continue;

      try {
        const eqIdx = text.indexOf("=", idx);
        if (eqIdx === -1) continue;
        const jsonPart = text.slice(eqIdx + 1);
        const endIdx = jsonPart.lastIndexOf("};");
        const jsonString =
          endIdx !== -1 ? jsonPart.slice(0, endIdx + 1) : jsonPart;
        const parsed = JSON.parse(jsonString.trim());
        return parsed;
      } catch (e) {
        // ignorujeme a zkusíme další script
      }
    }
    return null;
  }

  async function extractCaptionsText(playerResponse) {
    try {
      const tracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        return "";
      }

      const track = tracks[0];
      let url = track.baseUrl;

      if (!/[\?&]fmt=/.test(url)) {
        url += (url.includes("?") ? "&" : "?") + "fmt=json3";
      }

      const resp = await fetch(url);
      if (!resp.ok) return "";

      const data = await resp.json();
      if (!Array.isArray(data.events)) return "";

      const lines = [];
      for (const ev of data.events) {
        if (!Array.isArray(ev.segs)) continue;
        for (const seg of ev.segs) {
          if (seg.utf8) {
            lines.push(seg.utf8.trim());
          }
        }
      }

      return lines.join(" ").trim();
    } catch (e) {
      console.error("Chyba při extrakci titulků:", e);
      return "";
    }
  }

  function buildMetadataText(playerResponse, videoUrl) {
    const parts = [];

    const videoDetails = playerResponse?.videoDetails;
    const microformat = playerResponse?.microformat?.playerMicroformatRenderer;

    const title =
      videoDetails?.title ||
      microformat?.title?.simpleText ||
      document.title ||
      "";
    if (title) parts.push(`Název: ${title}`);

    const author =
      videoDetails?.author ||
      microformat?.ownerChannelName ||
      "";
    if (author) parts.push(`Autor: ${author}`);

    const lengthSeconds = videoDetails?.lengthSeconds;
    if (lengthSeconds) {
      parts.push(`Délka (s): ${lengthSeconds}`);
    }

    const description =
      videoDetails?.shortDescription ||
      microformat?.description?.simpleText ||
      document.querySelector("#description")?.innerText ||
      document
        .querySelector("meta[name='description']")
        ?.getAttribute("content") ||
      "";
    if (description) {
      parts.push("Popis:");
      parts.push(description);
    }

    if (videoUrl) {
      parts.push(`URL: ${videoUrl}`);
    }

    return parts.join("\n\n").trim();
  }

  function getVideoTitleFromPlayerResponse(playerResponse) {
    const videoDetails = playerResponse?.videoDetails;
    const microformat = playerResponse?.microformat?.playerMicroformatRenderer;

    return (
      videoDetails?.title ||
      microformat?.title?.simpleText ||
      document.title ||
      ""
    );
  }

  function getVideoIdFromUrl(urlString) {
    try {
      const url = new URL(urlString);
      if (url.hostname === "youtu.be") {
        return url.pathname.replace("/", "") || null;
      }
      if (url.hostname.endsWith("youtube.com")) {
        const v = url.searchParams.get("v");
        if (v) return v;
        const parts = url.pathname.split("/");
        const maybeId = parts[parts.length - 1];
        return maybeId || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  async function collectTextForSummarization(videoUrl) {
    const effectiveUrl = videoUrl || window.location.href;
    const playerResponse = getYtInitialPlayerResponse();
    const videoId = getVideoIdFromUrl(effectiveUrl);

    if (!playerResponse) {
      const title = document.title || "YouTube video";
      const fallback = buildMetadataText(null, effectiveUrl);
      return {
        source: "metadata",
        text: fallback || title,
        videoUrl: effectiveUrl,
        title,
        videoId
      };
    }

    const title = getVideoTitleFromPlayerResponse(playerResponse);

    const captionText = await extractCaptionsText(playerResponse);
    if (captionText) {
      return {
        source: "captions",
        text: captionText,
        videoUrl: effectiveUrl,
        title,
        videoId
      };
    }

    const metadataText = buildMetadataText(playerResponse, effectiveUrl);
    return {
      source: "metadata",
      text: metadataText,
      videoUrl: effectiveUrl,
      title,
      videoId
    };
  }

  // --- Message passing ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SUMMARIZE_WITH_GEMINI") {
      const videoUrl = message.videoUrl || window.location.href;
      const mode = message.mode || "all";

      // Okamžitě zobrazíme panel s loading spinnerem
      showGeminiPanel({
        summary: "",
        isLoading: true,
        error: "",
        source: "",
        allowSave: false
      });

      (async () => {
        const collected = await collectTextForSummarization(videoUrl);

        chrome.runtime.sendMessage({
          type: "YT_GEMINI_COLLECTED_TEXT",
          payload: {
            ...collected,
            mode
          }
        });
      })();

      return;
    }

    if (message.type === "YT_GEMINI_SUMMARY_READY") {
      const { summary, source } = message;
      showGeminiPanel({
        summary,
        isLoading: false,
        error: "",
        source,
        allowSave: true
      });
      return;
    }

    if (message.type === "YT_GEMINI_SUMMARY_ERROR") {
      const { error, source } = message;
      showGeminiPanel({
        summary: "",
        isLoading: false,
        error: error || "Během generování shrnutí došlo k chybě.",
        source,
        allowSave: false
      });
      return;
    }

    if (message.type === "YT_GEMINI_SUMMARY_SAVED") {
      const { source } = message;
      showGeminiPanel({
        summary: window.__geminiSummarizerLastSummary || "",
        isLoading: false,
        error: "",
        source,
        allowSave: false
      });
      return;
    }
  });
}