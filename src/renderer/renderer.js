// Global state
let allFiles = [];
let currentEditingFile = null;
let currentTags = [];
let currentFilter = "all";
let currentSearchTerm = "";
let currentSettings = {
    theme: "dark",
    language: "en",
    storagePath: "",
};

// i18n helper function
function t(key) {
    return window.i18n.t(key);
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await window.i18n.init(currentSettings.language);
    await loadFiles();
    setupEventListeners();
    applyTheme();
    window.i18n.applyTranslations();
});

// Setup event listeners
function setupEventListeners() {
    // Add file button
    document.getElementById("addFileBtn").addEventListener("click", addFile);

    // Empty state add file button
    document
        .getElementById("emptyStateAddFileBtn")
        .addEventListener("click", addFile);

    // Search input
    document.getElementById("searchInput").addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        renderFiles();
        updateStats();
    });

    // Filter chips
    document.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.addEventListener("click", (e) => {
            // Get the button element (in case a child span was clicked)
            const button = e.target.closest(".filter-chip");
            if (!button) return;

            document
                .querySelectorAll(".filter-chip")
                .forEach((c) => c.classList.remove("active"));
            button.classList.add("active");
            currentFilter = button.dataset.filter;
            renderFiles();
            updateStats();
        });
    });

    // Tag input in modal
    document.getElementById("tagInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag();
        }
    });

    // Close modal on background click
    document.getElementById("tagModal").addEventListener("click", (e) => {
        if (e.target.id === "tagModal") {
            closeTagModal();
        }
    });

    // Modal close button
    document
        .querySelector(".modal-close")
        .addEventListener("click", closeTagModal);

    // Modal cancel and save buttons (Tag Modal)
    const tagModalButtons = document.querySelectorAll(
        "#tagModal .modal-footer .btn"
    );
    tagModalButtons.forEach((btn) => {
        if (btn.classList.contains("btn-secondary")) {
            btn.addEventListener("click", closeTagModal);
        } else if (btn.classList.contains("btn-primary")) {
            btn.addEventListener("click", saveTags);
        }
    });

    // Settings button
    document
        .getElementById("settingsBtn")
        .addEventListener("click", openSettings);

    // Settings modal close buttons
    document
        .querySelector(".settings-modal-close")
        .addEventListener("click", closeSettings);
    document
        .getElementById("closeSettingsBtn")
        .addEventListener("click", closeSettings);

    // Settings modal background click
    document.getElementById("settingsModal").addEventListener("click", (e) => {
        if (e.target.id === "settingsModal") {
            closeSettings();
        }
    });

    // Theme toggle buttons
    document.querySelectorAll(".theme-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });

    // Language select
    document
        .getElementById("languageSelect")
        .addEventListener("change", (e) => {
            setLanguage(e.target.value);
        });

    // Change storage location button
    document
        .getElementById("changeStorageBtn")
        .addEventListener("click", changeStorageLocation);
}

// Load files from storage
async function loadFiles() {
    try {
        const result = await window.electronAPI.getFiles();
        if (result.success) {
            allFiles = result.files;
            renderFiles();
            updateStats();
        } else {
            showNotification(
                "Failed to load files: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error loading files:", error);
        showNotification("Failed to load files", "error");
    }
}

// Add file
async function addFile() {
    try {
        const result = await window.electronAPI.addFile();
        if (result.success) {
            allFiles.push(result.file);
            renderFiles();
            updateStats();
            showNotification("File added successfully!", "success");
            // Open tag editor for the newly added file
            openTagEditor(result.file.id);
        } else if (result.message !== "No file selected") {
            showNotification("Failed to add file: " + result.message, "error");
        }
    } catch (error) {
        console.error("Error adding file:", error);
        showNotification("Failed to add file", "error");
    }
}

// Remove file
async function removeFile(fileId) {
    if (!confirm(t("confirmRemoveFile"))) {
        return;
    }

    try {
        const result = await window.electronAPI.removeFile(fileId);
        if (result.success) {
            allFiles = allFiles.filter((f) => f.id !== fileId);
            renderFiles();
            updateStats();
            showNotification(t("fileRemovedSuccess"), "success");
        } else {
            showNotification(
                "Failed to remove file: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error removing file:", error);
        showNotification("Failed to remove file", "error");
    }
}

// Open file
async function openFile(fileId) {
    try {
        const result = await window.electronAPI.openFile(fileId);
        if (!result.success) {
            showNotification("Failed to open file: " + result.message, "error");
        }
    } catch (error) {
        console.error("Error opening file:", error);
        showNotification("Failed to open file", "error");
    }
}

// Show file in folder
async function showInFolder(fileId) {
    try {
        const result = await window.electronAPI.showInFolder(fileId);
        if (!result.success) {
            showNotification("Failed to show file: " + result.message, "error");
        }
    } catch (error) {
        console.error("Error showing file:", error);
        showNotification("Failed to show file", "error");
    }
}

// Open tag editor
function openTagEditor(fileId) {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file) return;

    currentEditingFile = file;
    currentTags = [...file.tags];

    document.getElementById("modalFilename").textContent = file.originalName;
    renderModalTags();
    document.getElementById("tagInput").value = "";
    document.getElementById("tagModal").classList.add("visible");
    document.getElementById("tagInput").focus();
}

// Attach event listeners to file cards
function attachFileCardListeners() {
    // Get all file cards
    const fileCards = document.querySelectorAll(".file-card");

    fileCards.forEach((card) => {
        const fileId = card.dataset.fileId;

        // Click on card to open file
        card.addEventListener("click", (e) => {
            // Only open if not clicking on a button
            if (!e.target.closest("button")) {
                openFile(fileId);
            }
        });

        // Tag button
        const tagBtn = card.querySelector(".tag-btn");
        if (tagBtn) {
            tagBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openTagEditor(fileId);
            });
        }

        // Folder button
        const folderBtn = card.querySelector(".folder-btn");
        if (folderBtn) {
            folderBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                showInFolder(fileId);
            });
        }

        // Delete button
        const deleteBtn = card.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                removeFile(fileId);
            });
        }
    });
}

// Close tag modal
function closeTagModal() {
    document.getElementById("tagModal").classList.remove("visible");
    currentEditingFile = null;
    currentTags = [];
}

// Add tag
function addTag() {
    const input = document.getElementById("tagInput");
    const tagText = input.value.trim();

    if (!tagText) return;

    if (currentTags.includes(tagText)) {
        showNotification(t("tagAlreadyExists"), "warning");
        return;
    }

    currentTags.push(tagText);
    renderModalTags();
    input.value = "";
}

// Remove tag
function removeTag(tag) {
    currentTags = currentTags.filter((t) => t !== tag);
    renderModalTags();
}

// Render tags in modal
function renderModalTags() {
    const container = document.getElementById("tagsContainer");

    if (currentTags.length === 0) {
        container.innerHTML = `<div class="tag-placeholder">${t(
            "noTagsYet"
        )}</div>`;
        return;
    }

    container.innerHTML = currentTags
        .map(
            (tag) => `
    <div class="tag-item">
      ${escapeHtml(tag)}
      <button class="tag-remove" onclick="removeTag('${escapeHtml(tag)}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `
        )
        .join("");
}

// Save tags
async function saveTags() {
    if (!currentEditingFile) return;

    try {
        const result = await window.electronAPI.updateTags(
            currentEditingFile.id,
            currentTags
        );
        if (result.success) {
            const fileIndex = allFiles.findIndex(
                (f) => f.id === currentEditingFile.id
            );
            if (fileIndex !== -1) {
                allFiles[fileIndex].tags = currentTags;
            }
            renderFiles();
            updateStats();
            closeTagModal();
            showNotification("Tags updated successfully!", "success");
        } else {
            showNotification(
                "Failed to update tags: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error saving tags:", error);
        showNotification("Failed to save tags", "error");
    }
}

// Render files
function renderFiles() {
    const filesList = document.getElementById("filesList");
    const emptyState = document.getElementById("emptyState");

    // Filter files
    let filteredFiles = filterFiles(allFiles);

    if (filteredFiles.length === 0) {
        filesList.style.display = "none";
        emptyState.classList.add("visible");
        return;
    }

    filesList.style.display = "grid";
    emptyState.classList.remove("visible");

    filesList.innerHTML = filteredFiles
        .map((file) => {
            const extension =
                file.extension.replace(".", "").toUpperCase() || "?";
            const date = new Date(file.dateAdded).toLocaleDateString();
            const size = formatFileSize(file.size);

            return `
      <div class="file-card" data-file-id="${file.id}">
        <div class="file-header">
          <div class="file-icon">${extension}</div>
          <div class="file-actions">
            <button class="icon-btn tag-btn" data-file-id="${
                file.id
            }" title="Edit tags">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </button>
            <button class="icon-btn folder-btn" data-file-id="${
                file.id
            }" title="Show in folder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="icon-btn danger delete-btn" data-file-id="${
                file.id
            }" title="Remove file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="file-name" title="${escapeHtml(
            file.originalName
        )}">${escapeHtml(file.originalName)}</div>
        <div class="file-meta">
          <div class="file-format">📄 ${escapeHtml(file.format)}</div>
          <div class="file-date">📅 ${date}</div>
          <div class="file-size">💾 ${size}</div>
        </div>
        <div class="file-tags">
          ${
              file.tags.length > 0
                  ? file.tags
                        .map(
                            (tag) =>
                                `<span class="tag">${escapeHtml(tag)}</span>`
                        )
                        .join("")
                  : '<span class="tag-placeholder">No tags</span>'
          }
        </div>
      </div>
    `;
        })
        .join("");

    // Attach event listeners to file cards
    attachFileCardListeners();
}

// Filter files
function filterFiles(files) {
    // Apply category filter
    let filtered = getFilesByCategory(currentFilter);

    // Apply search filter
    if (currentSearchTerm) {
        filtered = filtered.filter((file) => {
            const searchIn = [
                file.originalName.toLowerCase(),
                file.format.toLowerCase(),
                ...file.tags.map((t) => t.toLowerCase()),
            ].join(" ");

            return searchIn.includes(currentSearchTerm);
        });
    }

    return filtered;
}

// Helper function to check if a file belongs to a specific category
function fileMatchesCategory(file, category) {
    const format = file.format.toLowerCase();

    switch (category) {
        case "documents":
            return (
                format.includes("document") ||
                format.includes("pdf") ||
                format.includes("text") ||
                format.includes("markdown") ||
                format.includes("rtf")
            );
        case "images":
            return (
                format.includes("image") ||
                format.includes("jpg") ||
                format.includes("png") ||
                format.includes("gif") ||
                format.includes("svg") ||
                format.includes("webp") ||
                format.includes("bitmap")
            );
        case "videos":
            return (
                format.includes("video") ||
                format.includes("mp4") ||
                format.includes("avi") ||
                format.includes("mov") ||
                format.includes("mkv") ||
                format.includes("webm")
            );
        case "audio":
            return (
                format.includes("audio") ||
                format.includes("mp3") ||
                format.includes("wav") ||
                format.includes("ogg") ||
                format.includes("flac")
            );
        case "archives":
            return (
                format.includes("archive") ||
                format.includes("zip") ||
                format.includes("rar") ||
                format.includes("7-zip") ||
                format.includes("tar") ||
                format.includes("gzip")
            );
        case "code":
            return (
                format.includes("javascript") ||
                format.includes("python") ||
                format.includes("java") ||
                format.includes("c++") ||
                format.includes("c ") ||
                format.includes("html") ||
                format.includes("css") ||
                format.includes("json") ||
                format.includes("xml")
            );
        default:
            return false;
    }
}

// Get files by category
function getFilesByCategory(category) {
    if (category === "all") {
        return allFiles;
    }

    if (category === "other") {
        // "Other" includes files that don't match any specific category
        return allFiles.filter((file) => {
            const categories = [
                "documents",
                "images",
                "videos",
                "audio",
                "archives",
                "code",
            ];
            return !categories.some((cat) => fileMatchesCategory(file, cat));
        });
    }

    return allFiles.filter((file) => fileMatchesCategory(file, category));
}

// Update filter chip counts
function updateFilterCounts() {
    const categories = [
        "all",
        "documents",
        "images",
        "videos",
        "audio",
        "archives",
        "code",
        "other",
    ];

    categories.forEach((category) => {
        // Get files by category
        let categoryFiles = getFilesByCategory(category);

        // Apply search filter if active
        if (currentSearchTerm) {
            categoryFiles = categoryFiles.filter((file) => {
                const searchIn = [
                    file.originalName.toLowerCase(),
                    file.format.toLowerCase(),
                    ...file.tags.map((t) => t.toLowerCase()),
                ].join(" ");

                return searchIn.includes(currentSearchTerm);
            });
        }

        const count = categoryFiles.length;
        const chip = document.querySelector(
            `.filter-chip[data-filter="${category}"]`
        );
        if (chip) {
            const countElement = chip.querySelector(".filter-count");
            if (countElement) {
                countElement.textContent = count;
            }
        }
    });
}

// Update statistics
function updateStats() {
    // Get files for the current filter
    let filesToCount = getFilesByCategory(currentFilter);

    // Apply search filter if active
    if (currentSearchTerm) {
        filesToCount = filesToCount.filter((file) => {
            const searchIn = [
                file.originalName.toLowerCase(),
                file.format.toLowerCase(),
                ...file.tags.map((t) => t.toLowerCase()),
            ].join(" ");

            return searchIn.includes(currentSearchTerm);
        });
    }

    const totalFiles = filesToCount.length;
    const totalSize = filesToCount.reduce((sum, file) => sum + file.size, 0);
    const uniqueTags = new Set();
    filesToCount.forEach((file) => {
        file.tags.forEach((tag) => uniqueTags.add(tag));
    });

    document.getElementById("totalFiles").textContent = totalFiles;
    document.getElementById("totalTags").textContent = uniqueTags.size;
    document.getElementById("totalSize").textContent =
        formatFileSize(totalSize);

    // Update filter counts
    updateFilterCounts();
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Show notification (simple version - you can enhance this)
function showNotification(message, type = "info") {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // You could implement a toast notification system here
    if (type === "error") {
        alert(message);
    }
}

// Settings functions

// Load settings
async function loadSettings() {
    try {
        const result = await window.electronAPI.getSettings();
        if (result.success) {
            currentSettings = result.settings;
            updateSettingsUI();
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// Save settings
async function saveSettings() {
    try {
        const result = await window.electronAPI.saveSettings(currentSettings);
        if (!result.success) {
            showNotification(
                "Failed to save settings: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error saving settings:", error);
    }
}

// Open settings modal
function openSettings() {
    updateSettingsUI();
    document.getElementById("settingsModal").classList.add("visible");
}

// Close settings modal
function closeSettings() {
    document.getElementById("settingsModal").classList.remove("visible");
}

// Update settings UI
function updateSettingsUI() {
    // Update theme buttons
    document.querySelectorAll(".theme-option").forEach((btn) => {
        if (btn.dataset.theme === currentSettings.theme) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Update language select
    document.getElementById("languageSelect").value = currentSettings.language;

    // Update storage location display
    document.getElementById("storageLocationPath").textContent =
        currentSettings.storagePath || "Default location";
}

// Set theme
function setTheme(theme) {
    currentSettings.theme = theme;
    applyTheme();
    saveSettings();
    updateSettingsUI();
}

// Apply theme
function applyTheme() {
    if (currentSettings.theme === "light") {
        document.body.classList.add("light-theme");
    } else {
        document.body.classList.remove("light-theme");
    }
}

// Set language
async function setLanguage(language) {
    currentSettings.language = language;
    await window.i18n.changeLanguage(language);
    saveSettings();
    showNotification(t("languageUpdated"), "success");
}

// Change storage location
async function changeStorageLocation() {
    try {
        const result = await window.electronAPI.changeStorageLocation();
        if (result.success) {
            currentSettings.storagePath = result.path;
            updateSettingsUI();
            saveSettings();
            showNotification(
                "Storage location updated. Please restart the app.",
                "success"
            );
        } else if (result.message !== "No folder selected") {
            showNotification(
                "Failed to change storage location: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error changing storage location:", error);
        showNotification("Failed to change storage location", "error");
    }
}
