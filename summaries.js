let currentSummaries = [];

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString("cs-CZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function sourceLabel(source) {
  if (source === "captions") return "titulky";
  if (source === "metadata") return "metadata";
  return "nezjištěno";
}

function createSummaryCard(item) {
  const card = document.createElement("div");
  card.className = "summary-card";

  const header = document.createElement("div");
  header.className = "summary-header";

  const thumb = document.createElement("img");
  thumb.className = "thumb";
  thumb.alt = "";
  if (item.thumbnailUrl) {
    thumb.src = item.thumbnailUrl;
  }

  const meta = document.createElement("div");
  meta.className = "summary-meta";

  const title = document.createElement("div");
  title.className = "summary-title";
  title.textContent = item.title || "(bez názvu)";

  const info = document.createElement("div");
  info.className = "summary-info";

  const datePill = document.createElement("span");
  datePill.className = "pill";
  datePill.textContent = formatDate(item.createdAt);

  const srcPill = document.createElement("span");
  srcPill.className = "pill";
  srcPill.textContent = sourceLabel(item.source);

  const link = document.createElement("a");
  link.className = "video-link";
  link.href = item.videoUrl || "#";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "otevřít";
  link.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  info.appendChild(datePill);
  info.appendChild(srcPill);
  info.appendChild(link);

  meta.appendChild(title);
  meta.appendChild(info);

  const toggle = document.createElement("span");
  toggle.className = "toggle-icon";
  toggle.textContent = "▶";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Smazat";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteSummary(item.id);
  });

  header.appendChild(thumb);
  header.appendChild(meta);
  header.appendChild(toggle);
  header.appendChild(deleteBtn);

  const body = document.createElement("div");
  body.className = "summary-body";
  body.textContent = item.summary || "";

  card.appendChild(header);
  card.appendChild(body);

  card.addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  return card;
}

function renderSummaries(items) {
  currentSummaries = Array.isArray(items) ? items : [];

  const listEl = document.getElementById("summaryList");
  const emptyEl = document.getElementById("emptyState");

  listEl.innerHTML = "";

  if (!Array.isArray(currentSummaries) || currentSummaries.length === 0) {
    emptyEl.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";

  const sorted = [...currentSummaries].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  for (const item of sorted) {
    listEl.appendChild(createSummaryCard(item));
  }
}

function deleteSummary(id) {
  if (!id) return;

  currentSummaries = currentSummaries.filter((item) => item.id !== id);

  chrome.storage.local.set({ geminiSummaries: currentSummaries }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "Chyba při mazání shrnutí:",
        chrome.runtime.lastError.message
      );
      return;
    }
    renderSummaries(currentSummaries);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["geminiSummaries"], (res) => {
    const items = Array.isArray(res.geminiSummaries) ? res.geminiSummaries : [];
    renderSummaries(items);
  });
});

