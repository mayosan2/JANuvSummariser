const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_TEXT_CHARS = 12000;

let cachedGenerateModel = null;
const pendingSummariesByTab = {};

// Kontextové menu
chrome.runtime.onInstalled.addListener(() => {
  // Parent položka
  chrome.contextMenus.create({
    id: "summarize-with-gemini",
    title: "Summarize with Gemini",
    contexts: ["page", "video"],
    documentUrlPatterns: ["https://*.youtube.com/watch*"]
  });

  // Dětské položky – různé varianty shrnutí
  chrome.contextMenus.create({
    id: "summarize-gemini-all",
    parentId: "summarize-with-gemini",
    title: "All key points",
    contexts: ["page", "video"],
    documentUrlPatterns: ["https://*.youtube.com/watch*"]
  });

  chrome.contextMenus.create({
    id: "summarize-gemini-3keys",
    parentId: "summarize-with-gemini",
    title: "3 key points",
    contexts: ["page", "video"],
    documentUrlPatterns: ["https://*.youtube.com/watch*"]
  });

  chrome.contextMenus.create({
    id: "summarize-gemini-short",
    parentId: "summarize-with-gemini",
    title: "Short summary",
    contexts: ["page", "video"],
    documentUrlPatterns: ["https://*.youtube.com/watch*"]
  });

  chrome.contextMenus.create({
    id: "summarize-gemini-pareto",
    parentId: "summarize-with-gemini",
    title: "Pareto (80/20)",
    contexts: ["page", "video"],
    documentUrlPatterns: ["https://*.youtube.com/watch*"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id === undefined) {
    return;
  }

  let mode = null;
  switch (info.menuItemId) {
    case "summarize-gemini-all":
      mode = "all";
      break;
    case "summarize-gemini-3keys":
      mode = "3keys";
      break;
    case "summarize-gemini-short":
      mode = "short";
      break;
    case "summarize-gemini-pareto":
      mode = "pareto";
      break;
    default:
      return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    chrome.tabs.sendMessage(tab.id, {
      type: "SUMMARIZE_WITH_GEMINI",
      videoUrl: info.pageUrl || tab.url,
      mode
    });
  } catch (e) {
    console.error("Chyba při injektování content.js:", e);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete pendingSummariesByTab[tabId];
});

// Načtení Gemini API klíče z úložiště
async function getGeminiApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            "Chyba při čtení Gemini API klíče: " +
              chrome.runtime.lastError.message
          )
        );
        return;
      }

      const key = result.geminiApiKey;
      if (!key) {
        reject(
          new Error(
            "Gemini API klíč není nastaven. Otevři options stránku a ulož ho."
          )
        );
        return;
      }

      resolve(key);
    });
  });
}

// Zjištění dostupného modelu s generateContent pro daný API klíč
async function resolveGenerateModel(apiKey) {
  if (cachedGenerateModel) return cachedGenerateModel;

  const resp = await fetch(
    `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`,
    { method: "GET" }
  );

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `ListModels selhalo (${resp.status}): ${txt || resp.statusText}`
    );
  }

  const data = await resp.json();
  const models = Array.isArray(data.models) ? data.models : [];

  const candidates = models
    .filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
    )
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

const preferred = [
  "gemini-2.5-flash",       // ← dej 2.5 flash na první místo
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash-lite"
];

  for (const p of preferred) {
    if (candidates.includes(p)) {
      cachedGenerateModel = p;
      return p;
    }
  }

  const anyFlash = candidates.find((m) => m.includes("flash"));
  cachedGenerateModel = anyFlash || candidates[0];

  if (!cachedGenerateModel) {
    throw new Error(
      "Nenašel jsem žádný model s podporou generateContent pro tento API klíč."
    );
  }

  return cachedGenerateModel;
}

// Volání Gemini – vrací shrnutí + použitý model, ošetřuje 404/429
async function generateSummary(text, mode = "all") {
  if (!text || typeof text !== "string") {
    throw new Error("Text pro shrnutí je prázdný nebo neplatný.");
  }

  let usedText = text;
  let wasTruncated = false;

  if (text.length > MAX_TEXT_CHARS) {
    usedText = text.slice(0, MAX_TEXT_CHARS);
    wasTruncated = true;
  }

  const apiKey = await getGeminiApiKey();
  const model = await resolveGenerateModel(apiKey);

  let basePrompt;
  switch (mode) {
    case "3keys":
      basePrompt =
        "Explain 3 key points of the video based on the transcript below.";
      break;
    case "short":
      basePrompt =
        "Summarise the video in a few sentences based on the transcript below.";
      break;
    case "pareto":
      basePrompt =
        "Apply the Pareto Principle to this video: based on the transcript below, what is the 20% of information I need to learn to understand 80% of it?";
      break;
    case "all":
    default:
      basePrompt =
        "Explain all key points of the video based on the transcript below, using bullet points where helpful.";
      break;
  }

  let fullPrompt = `${basePrompt}\n\n---\n\n${usedText}`;
  if (wasTruncated) {
    fullPrompt =
      "Poznámka: transkript byl z důvodu délky zkrácen.\n\n" + fullPrompt;
  }

  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }]
  };

  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let data;
  let rawText = "";

  if (!response.ok) {
    try {
      data = await response.json();
    } catch {
      rawText = await response.text().catch(() => "");
    }

    // 404 – model už neexistuje, příště znovu zvolíme model
    if (response.status === 404) {
      cachedGenerateModel = null;
    }

    // 429 / RESOURCE_EXHAUSTED – překročená kvóta / free tier
    if (response.status === 429 && data?.error) {
      const msg =
        data.error.message ||
        "Překročil jsi kvótu pro Gemini API pro tento model.";
      throw new Error(
        "Překročil jsi kvótu Gemini API.\n\n" +
          msg +
          "\n\nZkontroluj prosím plán a billing na https://ai.google.dev/gemini-api/docs/rate-limits."
      );
    }

    const genericMsg =
      rawText || data?.error?.message || response.statusText;
    throw new Error(
      `Gemini API vrátilo chybu ${response.status}: ${genericMsg}`
    );
  }

  data = data || (await response.json());

  const summary =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || "";

  if (!summary) {
    throw new Error("Gemini API nevrátilo žádný text shrnutí.");
  }

  return { summary, modelUsed: model };
}

// Pomocné funkce pro video ID, thumbnail a ukládání shrnutí
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

function buildThumbnailUrl(videoId) {
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function saveSummary({ videoUrl, title, thumbnailUrl, summary, source }) {
  const createdAt = Date.now();
  const item = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    videoUrl,
    title,
    thumbnailUrl,
    summary,
    source,
    createdAt
  };

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["geminiSummaries"], (res) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            "Chyba při čtení uložených shrnutí: " +
              chrome.runtime.lastError.message
          )
        );
        return;
      }
      const current = Array.isArray(res.geminiSummaries)
        ? res.geminiSummaries
        : [];
      current.push(item);
      chrome.storage.local.set({ geminiSummaries: current }, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              "Chyba při ukládání shrnutí: " +
                chrome.runtime.lastError.message
            )
          );
        } else {
          // paralelně odešleme shrnutí i do vzdálené DB (pokud je zapnutá)
          sendSummaryToRemote(item).catch((err) => {
            console.error(
              "[Gemini Summarizer] Chyba při ukládání shrnutí do databáze:",
              err
            );
          });
          resolve();
        }
      });
    });
  });
}

async function getRemoteDbConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["remoteDbUrl", "remoteDbKey", "remoteDbEnabled"],
      (res) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Gemini Summarizer] Chyba při čtení nastavení databáze:",
            chrome.runtime.lastError.message
          );
          resolve({ enabled: false });
          return;
        }
        resolve({
          enabled: !!res.remoteDbEnabled,
          url: typeof res.remoteDbUrl === "string" ? res.remoteDbUrl.trim() : "",
          apiKey:
            typeof res.remoteDbKey === "string" ? res.remoteDbKey.trim() : ""
        });
      }
    );
  });
}

async function sendSummaryToRemote(item) {
  const cfg = await getRemoteDbConfig();
  if (!cfg.enabled || !cfg.url) return;

  const headers = {
    "Content-Type": "application/json"
  };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const resp = await fetch(cfg.url, {
    method: "POST",
    headers,
    body: JSON.stringify(item)
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Remote DB response ${resp.status}: ${txt || resp.statusText}`
    );
  }
}

async function handleSaveLastSummary(tab) {
  const pending = pendingSummariesByTab[tab.id];

  if (!pending) {
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: "YT_GEMINI_SUMMARY_ERROR",
        error:
          "Nemám k dispozici žádné nové shrnutí pro uložení. Nejprve prosím vygeneruj shrnutí videa.",
        videoUrl: tab.url || "",
        source: ""
      });
    } catch (e) {
      // tab nemusí mít content script, chybu ignorujeme
    }
    return;
  }

  await saveSummary(pending);
  delete pendingSummariesByTab[tab.id];

  try {
    chrome.tabs.sendMessage(tab.id, {
      type: "YT_GEMINI_SUMMARY_SAVED",
      videoUrl: pending.videoUrl,
      source: pending.source
    });
  } catch (e) {
    // pokud content script není připraven, prostě jen uložíme shrnutí
  }
}

// Příjem zpráv z content.js – generování a uložení shrnutí
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "YT_GEMINI_COLLECTED_TEXT") {
    const { source, text, videoUrl, title, videoId, mode } =
      message.payload || {};

    (async () => {
      try {
        const { summary, modelUsed } = await generateSummary(
          text,
          mode || "all"
        );

        const finalVideoUrl = videoUrl || "";
        const vid = videoId || getVideoIdFromUrl(finalVideoUrl);
        const thumb = buildThumbnailUrl(vid);
        const cachedItem = {
          videoUrl: finalVideoUrl,
          title: title || "(bez názvu)",
          thumbnailUrl: thumb,
          summary,
          source,
          variant: mode || "all"
        };

        if (sender.tab && sender.tab.id !== undefined) {
          pendingSummariesByTab[sender.tab.id] = cachedItem;
        }

        console.log(
          "[Gemini Summarizer] Shrnutí vygenerováno pro:",
          finalVideoUrl,
          "model:",
          modelUsed
        );

        if (sender.tab && sender.tab.id !== undefined) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "YT_GEMINI_SUMMARY_READY",
            summary,
            videoUrl: finalVideoUrl,
            source,
            modelUsed
          });
        }
      } catch (err) {
        console.error(
          "[Gemini Summarizer] Chyba při generování shrnutí:",
          err
        );

        if (sender.tab && sender.tab.id !== undefined) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "YT_GEMINI_SUMMARY_ERROR",
            error: err.message || String(err),
            videoUrl,
            source
          });
        }
      }
    })();

    return;
  }

  if (message.type === "YT_GEMINI_SAVE_LAST_SUMMARY") {
    if (sender.tab && sender.tab.id !== undefined) {
      (async () => {
        await handleSaveLastSummary(sender.tab);
      })();
    }
  }
});