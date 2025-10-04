const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
    // File operations
    addFile: () => ipcRenderer.invoke("add-file"),
    getFiles: () => ipcRenderer.invoke("get-files"),
    removeFile: (fileId) => ipcRenderer.invoke("remove-file", fileId),
    updateTags: (fileId, tags) =>
        ipcRenderer.invoke("update-tags", fileId, tags),
    renameFile: (fileId, newName) =>
        ipcRenderer.invoke("rename-file", fileId, newName),
    openFile: (fileId) => ipcRenderer.invoke("open-file", fileId),
    showInFolder: (fileId) => ipcRenderer.invoke("show-in-folder", fileId),
    saveFile: (fileId) => ipcRenderer.invoke("save-file", fileId),

    // Settings operations
    getSettings: () => ipcRenderer.invoke("get-settings"),
    saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
    changeStorageLocation: () => ipcRenderer.invoke("change-storage-location"),

    // Migration operations
    startMigration: (oldPath, newPath) =>
        ipcRenderer.invoke("start-migration", oldPath, newPath),
    onMigrationProgress: (callback) => {
        ipcRenderer.on("migration-progress", (event, progress) =>
            callback(progress)
        );
    },
    removeMigrationProgressListener: () => {
        ipcRenderer.removeAllListeners("migration-progress");
    },

    // Encryption/Security operations
    getEncryptionStatus: () => ipcRenderer.invoke("get-encryption-status"),
    setEncryptionPassword: (newPassword, oldPassword) =>
        ipcRenderer.invoke("set-encryption-password", newPassword, oldPassword),
    removeEncryptionPassword: (password) =>
        ipcRenderer.invoke("remove-encryption-password", password),
    lockApp: () => ipcRenderer.invoke("lock-app"),
    unlockApp: (password) => ipcRenderer.invoke("unlock-app", password),
    reEncryptAllFiles: () => ipcRenderer.invoke("re-encrypt-all-files"),
    quitApp: () => ipcRenderer.invoke("quit-app"),

    // Listen for re-encryption progress
    onReEncryptionProgress: (callback) => {
        ipcRenderer.on("re-encryption-progress", (event, progress) =>
            callback(progress)
        );
    },
    removeReEncryptionProgressListener: () => {
        ipcRenderer.removeAllListeners("re-encryption-progress");
    },

    // Open external links in system browser
    openExternalLink: (url) => ipcRenderer.invoke("open-external-link", url),

    // Get app version
    getAppVersion: () => ipcRenderer.invoke("get-app-version"),

    // AI Tagging operations
    getFileContent: (fileId) => ipcRenderer.invoke("get-file-content", fileId),
    generateAITags: (fileId) => ipcRenderer.invoke("generate-ai-tags", fileId),
});
