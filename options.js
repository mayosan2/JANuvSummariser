const apiKeyInput = document.getElementById("apiKey");
const remoteDbUrlInput = document.getElementById("remoteDbUrl");
const remoteDbKeyInput = document.getElementById("remoteDbKey");
const remoteDbEnabledInput = document.getElementById("remoteDbEnabled");
const form = document.getElementById("apiKeyForm");
const statusEl = document.getElementById("status");

// Načtení existujících hodnot při otevření stránky
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["geminiApiKey", "remoteDbUrl", "remoteDbKey", "remoteDbEnabled"],
    (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = "********";
      apiKeyInput.dataset.hasExisting = "true";
    }
      if (typeof result.remoteDbUrl === "string") {
        remoteDbUrlInput.value = result.remoteDbUrl;
      }
      if (typeof result.remoteDbKey === "string" && result.remoteDbKey) {
        remoteDbKeyInput.value = "********";
        remoteDbKeyInput.dataset.hasExisting = "true";
      }
      if (typeof result.remoteDbEnabled === "boolean") {
        remoteDbEnabledInput.checked = result.remoteDbEnabled;
      }
    }
  );
});

// Uložení klíče
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const newKeyRaw = apiKeyInput.value.trim();
  let newKeyToStore = "";

  if (apiKeyInput.dataset.hasExisting === "true" && newKeyRaw === "********") {
    // necháme původní klíč
    newKeyToStore = null;
  } else {
    newKeyToStore = newKeyRaw || "";
  }

  const remoteUrl = remoteDbUrlInput.value.trim();

  const remoteKeyRaw = remoteDbKeyInput.value.trim();
  let remoteKeyToStore = "";
  if (
    remoteDbKeyInput.dataset.hasExisting === "true" &&
    remoteKeyRaw === "********"
  ) {
    remoteKeyToStore = null;
  } else {
    remoteKeyToStore = remoteKeyRaw || "";
  }

  const remoteEnabled = !!remoteDbEnabledInput.checked;

  if (!newKeyToStore && newKeyToStore !== null) {
    showStatus("Zadej prosím platný Gemini API klíč.", true);
    return;
  }

  const toSet = {};

  if (newKeyToStore !== null) {
    toSet.geminiApiKey = newKeyToStore;
  }
  if (remoteKeyToStore !== null) {
    toSet.remoteDbKey = remoteKeyToStore;
  }
  toSet.remoteDbUrl = remoteUrl;
  toSet.remoteDbEnabled = remoteEnabled;

  chrome.storage.local.set(toSet, () => {
    if (newKeyToStore !== null) {
      apiKeyInput.value = "********";
      apiKeyInput.dataset.hasExisting = "true";
    }
    if (remoteKeyToStore !== null && remoteKeyToStore) {
      remoteDbKeyInput.value = "********";
      remoteDbKeyInput.dataset.hasExisting = "true";
    }
    showStatus("Nastavení bylo uloženo.");
  });
});

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#0a7a0a";

  setTimeout(() => {
    statusEl.textContent = "";
  }, 3000);
}