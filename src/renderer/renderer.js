// Global state
let allFiles = [];
let currentEditingFile = null;
let currentRenamingFile = null;
let currentTags = [];
let currentFilter = "all";
let currentSearchTerm = "";
let currentSettings = {
    theme: "dark",
    language: "en",
    storagePath: "",
};
let hasPassword = false; // Track if password is set

// i18n helper function
function t(key) {
    return window.i18n.t(key);
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await window.i18n.init(currentSettings.language);

    setupEventListeners();
    setupExternalLinks();
    applyTheme();
    window.i18n.applyTranslations();

    // Check encryption status
    const encStatus = await checkEncryptionStatus();

    // Update password UI based on encryption status
    await checkPasswordStatus();

    // If app is locked, show unlock dialog
    if (encStatus && encStatus.isLocked) {
        console.log("App is locked, showing unlock dialog");
        document.querySelector(".app-container").style.display = "none";
        showPasswordEntryDialog();
    } else {
        console.log("App is unlocked, loading files");
        await loadFiles();
    }
});

// Setup external links to open in system browser
function setupExternalLinks() {
    // Find all links with target="_blank" or external URLs
    document.addEventListener("click", (e) => {
        const link = e.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");

        // Check if it's an external link (http/https)
        if (
            href &&
            (href.startsWith("http://") || href.startsWith("https://"))
        ) {
            e.preventDefault();
            window.electronAPI.openExternalLink(href);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add file button
    document.getElementById("addFileBtn").addEventListener("click", addFile);

    // Empty state add file button
    document
        .getElementById("emptyStateAddFileBtn")
        .addEventListener("click", addFile);

    // Toggle password visibility buttons
    document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            const targetId = this.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const eyeIcon = this.querySelector(".eye-icon");
            const eyeOffIcon = this.querySelector(".eye-off-icon");

            if (input.type === "password") {
                input.type = "text";
                eyeIcon.style.display = "none";
                eyeOffIcon.style.display = "block";
            } else {
                input.type = "password";
                eyeIcon.style.display = "block";
                eyeOffIcon.style.display = "none";
            }
        });
    });

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
        .querySelector(".tag-modal-close")
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

    // Rename modal close buttons
    document
        .querySelector(".rename-modal-close")
        .addEventListener("click", closeRenameModal);
    document
        .getElementById("cancelRenameBtn")
        .addEventListener("click", closeRenameModal);
    document
        .getElementById("saveRenameBtn")
        .addEventListener("click", saveRename);

    // Rename modal background click
    document.getElementById("renameModal").addEventListener("click", (e) => {
        if (e.target.id === "renameModal") {
            closeRenameModal();
        }
    });

    // Rename input enter key
    document.getElementById("renameInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            saveRename();
        }
    });

    // About button
    document.getElementById("aboutBtn").addEventListener("click", openAbout);

    // About modal close buttons
    document
        .querySelector(".about-modal-close")
        .addEventListener("click", closeAbout);
    document
        .getElementById("closeAboutBtn")
        .addEventListener("click", closeAbout);

    // About modal background click
    document.getElementById("aboutModal").addEventListener("click", (e) => {
        if (e.target.id === "aboutModal") {
            closeAbout();
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

    // AI Settings button
    document
        .getElementById("saveAISettingsBtn")
        .addEventListener("click", saveAISettings);

    // Spark button (AI tagging)
    document
        .getElementById("sparkTagsBtn")
        .addEventListener("click", generateAITags);

    // Password/Security buttons
    document
        .getElementById("changePasswordBtn")
        .addEventListener("click", openPasswordSetup);

    // Password setup modal close
    document
        .querySelector(".password-setup-modal-close")
        .addEventListener("click", closePasswordSetup);
    document
        .getElementById("cancelPasswordBtn")
        .addEventListener("click", closePasswordSetup);

    // Password setup modal background click
    document
        .getElementById("passwordSetupModal")
        .addEventListener("click", (e) => {
            if (e.target.id === "passwordSetupModal") {
                closePasswordSetup();
            }
        });

    // Save password button
    document
        .getElementById("savePasswordBtn")
        .addEventListener("click", savePassword);

    // Remove password checkbox
    document
        .getElementById("removePasswordCheckbox")
        .addEventListener("change", (e) => {
            const passwordInputs = document.querySelectorAll(
                "#newPasswordInput, #confirmPasswordInput"
            );
            passwordInputs.forEach((input) => {
                input.disabled = e.target.checked;
                if (e.target.checked) {
                    input.value = "";
                }
            });
        });

    // Password entry modal buttons (startup)
    document.getElementById("unlockBtn").addEventListener("click", unlockApp);
    document.getElementById("quitAppBtn").addEventListener("click", quitApp);

    // Enter key in password inputs
    document
        .getElementById("startupPasswordInput")
        .addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                unlockApp();
            }
        });

    document
        .getElementById("newPasswordInput")
        .addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                document.getElementById("confirmPasswordInput").focus();
            }
        });

    document
        .getElementById("confirmPasswordInput")
        .addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                savePassword();
            }
        });
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
            showNotification(t("fileAddedSuccess"), "success");
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

// Save file to another location
async function saveFile(fileId) {
    try {
        const result = await window.electronAPI.saveFile(fileId);
        if (result.success) {
            showNotification(t("fileSavedSuccess"), "success");
        } else if (result.message !== "Save canceled") {
            showNotification("Failed to save file: " + result.message, "error");
        }
    } catch (error) {
        console.error("Error saving file:", error);
        showNotification("Failed to save file", "error");
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

        // Rename button
        const renameBtn = card.querySelector(".rename-btn");
        if (renameBtn) {
            renameBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openRenameDialog(fileId);
            });
        }

        // Save button
        const saveBtn = card.querySelector(".save-btn");
        if (saveBtn) {
            saveBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                saveFile(fileId);
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
      <button class="tag-remove" data-tag="${escapeHtml(tag)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `
        )
        .join("");

    // Add event listeners to tag remove buttons
    container.querySelectorAll(".tag-remove").forEach((button) => {
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            const tag = button.getAttribute("data-tag");
            removeTag(tag);
        });
    });
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
            showNotification(t("tagsUpdatedSuccess"), "success");
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

// Open rename dialog
function openRenameDialog(fileId) {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file) return;

    currentRenamingFile = file;
    document.getElementById("renameInput").value = file.originalName;
    document.getElementById("renameModal").classList.add("visible");
    document.getElementById("renameInput").focus();
    document.getElementById("renameInput").select();
}

// Close rename modal
function closeRenameModal() {
    document.getElementById("renameModal").classList.remove("visible");
    currentRenamingFile = null;
}

// Save rename
async function saveRename() {
    if (!currentRenamingFile) return;

    const newName = document.getElementById("renameInput").value.trim();

    if (!newName) {
        showNotification(
            t("fileNameRequired") || "File name is required",
            "warning"
        );
        return;
    }

    try {
        const result = await window.electronAPI.renameFile(
            currentRenamingFile.id,
            newName
        );
        if (result.success) {
            const fileIndex = allFiles.findIndex(
                (f) => f.id === currentRenamingFile.id
            );
            if (fileIndex !== -1) {
                allFiles[fileIndex].originalName = newName;
            }
            renderFiles();
            closeRenameModal();
            showNotification(
                t("fileRenamedSuccess") || "File renamed successfully!",
                "success"
            );
        } else {
            showNotification(
                "Failed to rename file: " + result.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Error renaming file:", error);
        showNotification("Failed to rename file", "error");
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
            <button class="icon-btn rename-btn" data-file-id="${
                file.id
            }" title="Rename file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn save-btn" data-file-id="${
                file.id
            }" title="Save file to another location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
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

// Show notification with toast
function showNotification(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) {
        console.error("Toast container not found");
        return;
    }

    // Create toast element
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    // Get icon based on type
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <circle cx="12" cy="12" r="10"/>
                 <line x1="12" y1="16" x2="12" y2="12"/>
                 <line x1="12" y1="8" x2="12.01" y2="8"/>
               </svg>`,
    };

    toast.innerHTML = `
        <div class="toast-icon">
            ${icons[type] || icons.info}
        </div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </button>
    `;

    // Add close button handler
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
        removeToast(toast);
    });

    // Add to container
    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        removeToast(toast);
    }, 5000);
}

// Remove toast with animation
function removeToast(toast) {
    if (!toast || !toast.parentElement) return;

    toast.classList.add("toast-hiding");
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300);
}

// About functions

// Open about modal
async function openAbout() {
    // Fetch and display app version
    try {
        const versionResult = await window.electronAPI.getAppVersion();
        if (versionResult.success) {
            const versionElement = document.querySelector(".about-version");
            if (versionElement) {
                // Get the translated "Version" text
                const versionLabel = t("aboutVersion");
                versionElement.textContent = `${versionLabel} ${versionResult.version}`;
            }
        }
    } catch (error) {
        console.error("Error fetching app version:", error);
    }

    document.getElementById("aboutModal").classList.add("visible");
}

// Close about modal
function closeAbout() {
    document.getElementById("aboutModal").classList.remove("visible");
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

    // Update AI settings
    document.getElementById("aiEndpointInput").value =
        currentSettings.aiApiEndpoint || "https://api.openai.com/v1";
    document.getElementById("aiModelInput").value =
        currentSettings.aiModel || "gpt-4o-mini";
    document.getElementById("aiKeyInput").value =
        currentSettings.aiApiKey || "";
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
        if (result.success && result.needsMigration) {
            // Don't close settings modal - let user see what's happening
            // Start migration process
            await startMigration(result.oldPath, result.path);
        } else if (result.message === "Same location selected") {
            showNotification(
                t("sameLocationSelected") || "Same location selected",
                "warning"
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

// Show progress modal with title and message
function showProgressModal(title, message) {
    const modal = document.getElementById("progressModal");
    const modalTitle = document.getElementById("progressModalTitle");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const progressMessage = document.getElementById("progressMessage");

    modalTitle.textContent = title;
    progressMessage.textContent = message;
    progressFill.style.width = "0%";
    progressText.textContent = "0%";

    modal.classList.add("visible");
}

// Update progress modal
function updateProgressModal(progress, message) {
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const progressMessage = document.getElementById("progressMessage");

    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    if (message) {
        progressMessage.textContent = message;
    }
}

// Hide progress modal
function hideProgressModal() {
    const modal = document.getElementById("progressModal");
    modal.classList.remove("visible");
}

// Start migration process
async function startMigration(oldPath, newPath) {
    // Show progress modal
    showProgressModal(
        t("migrationTitle") || "Migrating Data",
        t("migrationDescription") || "Preparing migration..."
    );

    // Listen for progress updates
    window.electronAPI.onMigrationProgress((progress) => {
        // Calculate overall progress
        let overallProgress = 0;
        let message = progress.message || "";

        if (progress.stage === "metadata") {
            overallProgress = progress.progress * 0.2; // Metadata is 20% of total
        } else if (progress.stage === "files") {
            overallProgress = 20 + progress.progress * 0.8; // Files are 80% of total
            if (progress.current && progress.total) {
                message = `${message} (${progress.current}/${progress.total})`;
            }
        } else if (progress.stage === "complete") {
            overallProgress = 100;
            message = t("migrationComplete") || "Migration complete!";
        } else if (progress.stage === "error") {
            message = t("migrationError") || "Error: " + progress.message;
        }

        updateProgressModal(Math.round(overallProgress), message);
    });

    try {
        // Start migration
        const result = await window.electronAPI.startMigration(
            oldPath,
            newPath
        );

        if (result.success) {
            // Migration complete
            showNotification(
                t("migrationComplete") || "Migration completed successfully!",
                "success"
            );

            // Update settings
            currentSettings.storagePath = newPath;
            updateSettingsUI();

            // Wait a bit before closing modal
            setTimeout(() => {
                hideProgressModal();
                window.electronAPI.removeMigrationProgressListener();

                // Reload files
                loadFiles();
            }, 2000);
        } else {
            showNotification(
                t("migrationFailed") || "Migration failed: " + result.message,
                "error"
            );

            setTimeout(() => {
                hideProgressModal();
                window.electronAPI.removeMigrationProgressListener();
            }, 3000);
        }
    } catch (error) {
        console.error("Migration error:", error);
        showNotification("Migration failed: " + error.message, "error");

        setTimeout(() => {
            hideProgressModal();
            window.electronAPI.removeMigrationProgressListener();
        }, 3000);
    }
}

// Password/Security functions

// Check if password is set
async function checkPasswordStatus() {
    try {
        // Use encryption manager to check password status
        const status = await window.electronAPI.getEncryptionStatus();
        if (status.success) {
            hasPassword = status.hasPassword;
            updatePasswordUI();
        }
    } catch (error) {
        console.error("Error checking password status:", error);
    }
}

// Update password UI in settings
function updatePasswordUI() {
    const button = document.getElementById("changePasswordBtn");
    const description = document.getElementById("passwordStatusDesc");

    if (hasPassword) {
        button.textContent = t("settingsChangePassword") || "Change Password";
        description.textContent =
            t("passwordStatusEnabled") || "Password protection is enabled";
    } else {
        button.textContent = t("settingsSetPassword") || "Set Password";
        description.textContent =
            t("settingsPasswordDesc") ||
            "Require password to access the application";
    }
}

// Open password setup modal
function openPasswordSetup() {
    const modal = document.getElementById("passwordSetupModal");
    const title = document.getElementById("passwordSetupTitle");
    const currentPasswordGroup = document.getElementById(
        "currentPasswordGroup"
    );
    const removePasswordGroup = document.getElementById("removePasswordGroup");
    const saveBtn = document.getElementById("savePasswordBtn");

    // Clear all inputs
    document.getElementById("currentPasswordInput").value = "";
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("confirmPasswordInput").value = "";
    document.getElementById("removePasswordCheckbox").checked = false;

    // Enable password inputs
    document.getElementById("newPasswordInput").disabled = false;
    document.getElementById("confirmPasswordInput").disabled = false;

    if (hasPassword) {
        // Changing existing password
        title.textContent = t("passwordChangeTitle") || "Change Password";
        currentPasswordGroup.style.display = "block";
        removePasswordGroup.style.display = "block";
        saveBtn.textContent = t("savePassword") || "Save Password";
    } else {
        // Setting new password
        title.textContent = t("passwordSetupTitle") || "Set Password";
        currentPasswordGroup.style.display = "none";
        removePasswordGroup.style.display = "none";
        saveBtn.textContent = t("savePassword") || "Save Password";
    }

    modal.classList.add("visible");

    // Focus appropriate input
    setTimeout(() => {
        if (hasPassword) {
            document.getElementById("currentPasswordInput").focus();
        } else {
            document.getElementById("newPasswordInput").focus();
        }
    }, 100);
}

// Close password setup modal
function closePasswordSetup() {
    document.getElementById("passwordSetupModal").classList.remove("visible");
}

// Save password
async function savePassword() {
    const currentPassword = document.getElementById(
        "currentPasswordInput"
    ).value;
    const newPassword = document.getElementById("newPasswordInput").value;
    const confirmPassword = document.getElementById(
        "confirmPasswordInput"
    ).value;
    const removePassword = document.getElementById(
        "removePasswordCheckbox"
    ).checked;

    try {
        // If removing password
        if (removePassword && hasPassword) {
            if (!currentPassword) {
                showNotification(
                    t("passwordRequired") || "Password is required",
                    "warning"
                );
                return;
            }

            // Use new encryption system
            const result = await window.electronAPI.removeEncryptionPassword(
                currentPassword
            );
            if (result.success) {
                hasPassword = false;
                updatePasswordUI();
                closePasswordSetup();
                showNotification(
                    t("passwordRemoveSuccess") ||
                        "Password removed successfully!",
                    "success"
                );
            } else {
                showNotification(
                    t("currentPasswordIncorrect") ||
                        "Current password is incorrect",
                    "error"
                );
            }
            return;
        }

        // Validate new password
        if (!newPassword) {
            showNotification(
                t("passwordRequired") || "Password is required",
                "warning"
            );
            return;
        }

        if (newPassword.length < 6) {
            showNotification(
                t("passwordTooShort") ||
                    "Password must be at least 6 characters",
                "warning"
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification(
                t("passwordMismatch") || "Passwords do not match",
                "warning"
            );
            return;
        }

        // Use new encryption system
        const result = await window.electronAPI.setEncryptionPassword(
            newPassword,
            hasPassword ? currentPassword : null
        );

        if (result.success) {
            const wasSet = hasPassword;
            closePasswordSetup();

            // If needs re-encryption of all files
            if (result.needsReEncryption) {
                await reEncryptAllFiles();
            }

            hasPassword = true;
            updatePasswordUI();

            if (wasSet) {
                showNotification(
                    t("passwordChangeSuccess") ||
                        "Password changed successfully!",
                    "success"
                );
            } else {
                showNotification(
                    t("passwordSetSuccess") || "Password set successfully!",
                    "success"
                );
            }
        } else {
            if (result.error && result.error.includes("password")) {
                showNotification(
                    t("currentPasswordIncorrect") ||
                        "Current password is incorrect",
                    "error"
                );
            } else {
                showNotification(
                    "Failed to save password: " +
                        (result.error || result.message),
                    "error"
                );
            }
        }
    } catch (error) {
        console.error("Error saving password:", error);
        showNotification("Failed to save password", "error");
    }
}

// Show password entry dialog on startup
function showPasswordEntryDialog() {
    console.log("showPasswordEntryDialog called");
    const modal = document.getElementById("passwordEntryModal");
    const input = document.getElementById("startupPasswordInput");
    const errorDiv = document.getElementById("passwordError");

    if (!modal) {
        console.error("Password entry modal not found!");
        return;
    }

    console.log("Modal found, showing password dialog");

    // Clear input and error
    input.value = "";
    errorDiv.style.display = "none";

    // Show modal (can't be closed by clicking outside)
    modal.classList.add("visible");
    modal.style.pointerEvents = "all"; // Make sure modal blocks interaction

    console.log("Modal classes:", modal.className);
    console.log("Modal display:", window.getComputedStyle(modal).display);

    // Focus input
    setTimeout(() => {
        input.focus();
    }, 100);
}

// Unlock app with password (supports both old and new encryption system)
async function unlockApp() {
    const input = document.getElementById("startupPasswordInput");
    const errorDiv = document.getElementById("passwordError");
    const password = input.value;

    if (!password) {
        errorDiv.style.display = "block";
        errorDiv.querySelector("span").textContent =
            t("passwordRequired") || "Password is required";
        return;
    }

    try {
        // Use encryption system to unlock
        const result = await window.electronAPI.unlockApp(password);

        if (result.success) {
            // Password correct - hide modal and show app content
            document
                .getElementById("passwordEntryModal")
                .classList.remove("visible");
            document.querySelector(".app-container").style.display = "block";

            // Load files now that user is authenticated
            await loadFiles();
        } else {
            // Password incorrect - show error
            errorDiv.style.display = "block";
            errorDiv.querySelector("span").textContent =
                t("incorrectPassword") ||
                "Incorrect password. Please try again.";
            input.value = "";
            input.focus();
        }
    } catch (error) {
        console.error("Error unlocking app:", error);
        showNotification("Failed to unlock application", "error");
    }
}

// Quit application
async function quitApp() {
    try {
        await window.electronAPI.quitApp();
    } catch (error) {
        console.error("Error quitting app:", error);
    }
}

// ========== NEW ENCRYPTION SYSTEM ==========

// Check encryption status on app load
async function checkEncryptionStatus() {
    try {
        const status = await window.electronAPI.getEncryptionStatus();
        if (status.success) {
            console.log("Encryption status:", status);

            // If locked, show unlock dialog
            if (status.isLocked) {
                showUnlockDialog();
            }

            return status;
        }
    } catch (error) {
        console.error("Error checking encryption status:", error);
    }
    return null;
}

// Show unlock dialog for encrypted app
function showUnlockDialog() {
    // Hide main content
    document.querySelector(".app-container").style.display = "none";

    // Show unlock dialog (reuse existing password entry modal)
    showPasswordEntryDialog();
}

// Enhanced password setup to support new encryption system
// Re-encrypt all files with progress tracking
async function reEncryptAllFiles() {
    showProgressModal(
        t("reEncryptingFiles") || "Re-encrypting Files",
        t("pleaseWait") || "Please wait while we secure your files..."
    );

    // Listen for progress updates
    window.electronAPI.onReEncryptionProgress((progress) => {
        updateProgressModal(
            progress.percentage,
            `${t("processing") || "Processing"} ${progress.current} / ${
                progress.total
            }`
        );
    });

    try {
        const result = await window.electronAPI.reEncryptAllFiles();

        if (result.success) {
            updateProgressModal(100, t("complete") || "Complete!");
            setTimeout(() => {
                closeProgressModal();
                showNotification(
                    t("reEncryptionSuccess") ||
                        "All files have been secured with the new password",
                    "success"
                );
            }, 1000);
        } else {
            closeProgressModal();
            showNotification(
                t("reEncryptionError") ||
                    "Some files could not be re-encrypted",
                "error"
            );
            if (result.errors) {
                console.error("Re-encryption errors:", result.errors);
            }
        }
    } catch (error) {
        console.error("Error re-encrypting files:", error);
        closeProgressModal();
        showNotification(
            t("reEncryptionError") || "Failed to re-encrypt files",
            "error"
        );
    } finally {
        window.electronAPI.removeReEncryptionProgressListener();
    }
}

// Lock the application
async function lockApp() {
    try {
        const result = await window.electronAPI.lockApp();
        if (result.success) {
            // Hide main content and show unlock dialog
            showUnlockDialog();
            showNotification(t("appLocked") || "Application locked", "success");
        } else {
            showNotification(
                result.error || t("lockFailed") || "Failed to lock application",
                "error"
            );
        }
    } catch (error) {
        console.error("Error locking app:", error);
        showNotification(
            t("lockFailed") || "Failed to lock application",
            "error"
        );
    }
}

// Enhanced unlock to work with new encryption system
// Close progress modal
function closeProgressModal() {
    const modal = document.getElementById("progressModal");
    modal.classList.remove("visible");
}

// AI Settings functions

// Save AI settings
async function saveAISettings() {
    const aiEndpoint = document.getElementById("aiEndpointInput").value.trim();
    const aiModel = document.getElementById("aiModelInput").value.trim();
    const aiKey = document.getElementById("aiKeyInput").value.trim();

    // Update current settings
    currentSettings.aiApiEndpoint = aiEndpoint || "https://api.openai.com/v1";
    currentSettings.aiModel = aiModel || "gpt-4o-mini";
    currentSettings.aiApiKey = aiKey;

    // Save to file
    try {
        await saveSettings();
        showNotification(t("aiSettingsSaved"), "success");
    } catch (error) {
        console.error("Error saving AI settings:", error);
        showNotification("Failed to save AI settings", "error");
    }
}

// Generate AI tags for current file
async function generateAITags() {
    if (!currentEditingFile) {
        showNotification("No file selected", "error");
        return;
    }

    // Check if AI is configured
    if (!currentSettings.aiApiKey) {
        showNotification(t("aiNotConfigured"), "warning");
        return;
    }

    // Disable button and show loading state
    const sparkBtn = document.getElementById("sparkTagsBtn");
    const originalContent = sparkBtn.innerHTML;
    sparkBtn.disabled = true;
    sparkBtn.innerHTML = `
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
        </svg>
        <span>${t("generatingTags")}</span>
    `;

    try {
        // Call AI tagging API
        const result = await window.electronAPI.generateAITags(
            currentEditingFile.id
        );

        if (result.success && result.tags) {
            // Add generated tags to current tags (avoid duplicates)
            result.tags.forEach((tag) => {
                if (!currentTags.includes(tag)) {
                    currentTags.push(tag);
                }
            });

            renderModalTags();
            showNotification(t("aiTagsGenerated"), "success");
        } else {
            showNotification(result.error || t("aiTagsError"), "error");
        }
    } catch (error) {
        console.error("Error generating AI tags:", error);
        showNotification(t("aiTagsError"), "error");
    } finally {
        // Restore button
        sparkBtn.disabled = false;
        sparkBtn.innerHTML = originalContent;
    }
}
