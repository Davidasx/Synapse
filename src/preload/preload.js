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
    openFile: (fileId) => ipcRenderer.invoke("open-file", fileId),
    showInFolder: (fileId) => ipcRenderer.invoke("show-in-folder", fileId),

    // Settings operations
    getSettings: () => ipcRenderer.invoke("get-settings"),
    saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
    changeStorageLocation: () => ipcRenderer.invoke("change-storage-location"),
});
