// Set GTK_USE_PORTAL for native file dialogs on Linux
if (process.platform === "linux") {
    process.env.GTK_USE_PORTAL = "1";
}

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const encryptionManager = require("./encryption");

// Fixed settings path (always in userData)
const SETTINGS_PATH = path.join(
    app.getPath("userData"),
    "synapse-settings.json"
);

// Dynamic storage paths - will be initialized after reading settings
let APP_DATA_PATH;
let FILES_PATH;
let METADATA_PATH;
let TEMP_PATH;

let mainWindow;
let currentSettings;

// Track opened temp files
let openedTempFiles = new Map(); // Maps temp file path to original stored file info

// Default settings
const DEFAULT_SETTINGS = {
    theme: "dark",
    language: "en",
    storagePath: path.join(app.getPath("userData"), "synapse-data"),
};

// Initialize storage paths from settings
function initializeStoragePaths(storagePath) {
    APP_DATA_PATH = storagePath;
    FILES_PATH = path.join(APP_DATA_PATH, "files");
    METADATA_PATH = path.join(APP_DATA_PATH, "metadata.json");
    TEMP_PATH = path.join(APP_DATA_PATH, "temp");
}

// Load settings (must be called before anything else)
function loadSettings() {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) {
            // First time setup - create default settings
            fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
            fs.writeFileSync(
                SETTINGS_PATH,
                JSON.stringify(DEFAULT_SETTINGS, null, 2)
            );
            currentSettings = { ...DEFAULT_SETTINGS };
        } else {
            const data = fs.readFileSync(SETTINGS_PATH, "utf8");
            currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        }

        // Initialize storage paths from settings
        initializeStoragePaths(currentSettings.storagePath);

        return currentSettings;
    } catch (error) {
        console.error("Error loading settings:", error);
        currentSettings = { ...DEFAULT_SETTINGS };
        initializeStoragePaths(currentSettings.storagePath);
        return currentSettings;
    }
}

// Save settings to fixed location
function saveSettingsToFile(settings) {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        currentSettings = settings;
        return true;
    } catch (error) {
        console.error("Error saving settings:", error);
        return false;
    }
}

// Initialize data directories (called after settings are loaded)
function initializeDataDirectories() {
    if (!fs.existsSync(APP_DATA_PATH)) {
        fs.mkdirSync(APP_DATA_PATH, { recursive: true });
    }
    if (!fs.existsSync(FILES_PATH)) {
        fs.mkdirSync(FILES_PATH, { recursive: true });
    }
    if (!fs.existsSync(TEMP_PATH)) {
        fs.mkdirSync(TEMP_PATH, { recursive: true });
    } else {
        // Clean temp directory on startup
        cleanTempDirectory();
    }
    if (!fs.existsSync(METADATA_PATH)) {
        fs.writeFileSync(METADATA_PATH, JSON.stringify({ files: [] }, null, 2));
    }
}

// Clean temp directory
function cleanTempDirectory() {
    try {
        if (fs.existsSync(TEMP_PATH)) {
            const files = fs.readdirSync(TEMP_PATH);
            files.forEach((file) => {
                const filePath = path.join(TEMP_PATH, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error(`Error deleting temp file ${file}:`, err);
                }
            });
        }
    } catch (error) {
        console.error("Error cleaning temp directory:", error);
    }
}

// Clean up a specific temp file
function cleanupTempFile(tempFilePath, watcher) {
    try {
        // Close the watcher
        if (watcher) {
            watcher.close();
        }

        // Remove from tracking
        openedTempFiles.delete(tempFilePath);

        // Delete the temp file if it still exists
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    } catch (error) {
        console.error("Error cleaning up temp file:", error);
    }
}

// Clean all temp files and watchers
function cleanupAllTempFiles() {
    try {
        // Close all watchers and remove temp files
        for (const [tempPath, info] of openedTempFiles.entries()) {
            if (info.watcher) {
                info.watcher.close();
            }
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (err) {
                    console.error(`Error deleting temp file ${tempPath}:`, err);
                }
            }
        }
        openedTempFiles.clear();
    } catch (error) {
        console.error("Error cleaning up all temp files:", error);
    }
}

// Migrate data from old location to new location
async function migrateData(oldPath, newPath, progressCallback) {
    try {
        const oldFilesPath = path.join(oldPath, "files");
        const oldMetadataPath = path.join(oldPath, "metadata.json");

        const newFilesPath = path.join(newPath, "files");
        const newMetadataPath = path.join(newPath, "metadata.json");

        // Create new directory structure
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true });
        }
        if (!fs.existsSync(newFilesPath)) {
            fs.mkdirSync(newFilesPath, { recursive: true });
        }

        progressCallback({
            stage: "metadata",
            progress: 0,
            message: "Copying metadata...",
        });

        // Copy metadata file
        if (fs.existsSync(oldMetadataPath)) {
            fs.copyFileSync(oldMetadataPath, newMetadataPath);
        } else {
            // Create empty metadata if it doesn't exist
            fs.writeFileSync(
                newMetadataPath,
                JSON.stringify({ files: [] }, null, 2)
            );
        }

        progressCallback({
            stage: "metadata",
            progress: 100,
            message: "Metadata copied",
        });

        // Get list of files to copy
        if (fs.existsSync(oldFilesPath)) {
            const files = fs.readdirSync(oldFilesPath);
            const totalFiles = files.length;

            if (totalFiles > 0) {
                progressCallback({
                    stage: "files",
                    progress: 0,
                    current: 0,
                    total: totalFiles,
                    message: `Copying files (0/${totalFiles})...`,
                });

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const oldFilePath = path.join(oldFilesPath, file);
                    const newFilePath = path.join(newFilesPath, file);

                    // Copy file
                    fs.copyFileSync(oldFilePath, newFilePath);

                    const progress = Math.round(((i + 1) / totalFiles) * 100);
                    progressCallback({
                        stage: "files",
                        progress: progress,
                        current: i + 1,
                        total: totalFiles,
                        message: `Copying files (${i + 1}/${totalFiles})...`,
                    });
                }
            }
        }

        progressCallback({
            stage: "complete",
            progress: 100,
            message: "Migration complete!",
        });

        // Delete old data folder
        try {
            if (fs.existsSync(oldPath)) {
                fs.rmSync(oldPath, { recursive: true, force: true });
            }
        } catch (deleteError) {
            console.error("Error deleting old data folder:", deleteError);
            // Continue anyway - migration was successful
        }

        return { success: true };
    } catch (error) {
        console.error("Error during migration:", error);
        progressCallback({
            stage: "error",
            progress: 0,
            message: error.message,
        });
        return { success: false, message: error.message };
    }
}

// Read metadata
function readMetadata() {
    try {
        if (!fs.existsSync(METADATA_PATH)) {
            return { files: [] };
        }

        const data = fs.readFileSync(METADATA_PATH, "utf8");

        // Try to parse as encrypted data first
        try {
            const encryptedData = JSON.parse(data);

            // Check if it's encrypted format (has encrypted, iv, authTag fields)
            if (
                encryptedData.encrypted &&
                encryptedData.iv &&
                encryptedData.authTag
            ) {
                // Decrypt metadata
                if (encryptionManager.getStatus().isLocked) {
                    console.warn("Cannot read metadata: app is locked");
                    return { files: [] };
                }

                const decryptedContent =
                    encryptionManager.decryptContent(encryptedData);
                return JSON.parse(decryptedContent);
            } else {
                // It's already plaintext metadata (old format or files array)
                return encryptedData;
            }
        } catch (parseError) {
            // If parsing fails, it might be old plaintext format
            console.error("Error parsing metadata:", parseError);
            return { files: [] };
        }
    } catch (error) {
        console.error("Error reading metadata:", error);
        return { files: [] };
    }
}

// Write metadata
function writeMetadata(metadata) {
    try {
        // Encrypt metadata before saving
        const metadataJson = JSON.stringify(metadata, null, 2);

        // Check if encryption is available
        if (encryptionManager.getStatus().isLocked) {
            console.warn("Cannot write metadata: app is locked");
            return false;
        }

        const encryptedData = encryptionManager.encryptContent(metadataJson);
        fs.writeFileSync(METADATA_PATH, JSON.stringify(encryptedData, null, 2));
        return true;
    } catch (error) {
        console.error("Error writing metadata:", error);
        return false;
    }
}

// Generate random filename
function generateRandomFilename(extension) {
    const randomString = crypto.randomBytes(16).toString("hex");
    return extension ? `${randomString}${extension}` : randomString;
}

// Get file extension
function getFileExtension(filename) {
    const ext = path.extname(filename);
    return ext || "";
}

// Get file format/type
function getFileFormat(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (!ext) return "Unknown";

    const formats = {
        // Documents
        ".pdf": "PDF Document",
        ".doc": "Word Document",
        ".docx": "Word Document",
        ".txt": "Text File",
        ".md": "Markdown",
        ".rtf": "Rich Text",

        // Images
        ".jpg": "JPEG Image",
        ".jpeg": "JPEG Image",
        ".png": "PNG Image",
        ".gif": "GIF Image",
        ".bmp": "Bitmap Image",
        ".svg": "SVG Image",
        ".webp": "WebP Image",

        // Videos
        ".mp4": "MP4 Video",
        ".avi": "AVI Video",
        ".mov": "MOV Video",
        ".mkv": "MKV Video",
        ".webm": "WebM Video",

        // Audio
        ".mp3": "MP3 Audio",
        ".wav": "WAV Audio",
        ".ogg": "OGG Audio",
        ".flac": "FLAC Audio",

        // Archives
        ".zip": "ZIP Archive",
        ".rar": "RAR Archive",
        ".7z": "7-Zip Archive",
        ".tar": "TAR Archive",
        ".gz": "GZip Archive",

        // Code
        ".js": "JavaScript",
        ".py": "Python",
        ".java": "Java",
        ".cpp": "C++",
        ".c": "C",
        ".html": "HTML",
        ".css": "CSS",
        ".json": "JSON",
        ".xml": "XML",
    };

    return formats[ext] || ext.substring(1).toUpperCase() + " File";
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "../preload/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, "../renderer/icon.ico"),
        show: false, // Don't show window immediately
    });

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

    // Open DevTools in development mode
    if (process.argv.includes("--dev")) {
        mainWindow.webContents.openDevTools();
    }

    // Handle window ready - always show window once loaded
    // The renderer will handle password dialog if needed
    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.show();
    });
}

app.whenReady().then(async () => {
    // Load settings first to get storage path
    loadSettings();

    // Initialize data directories based on settings
    initializeDataDirectories();

    // Initialize encryption system
    try {
        await encryptionManager.initialize();
        console.log("Encryption system initialized");
    } catch (error) {
        console.error("Failed to initialize encryption:", error);
    }

    // Remove the default menu bar
    Menu.setApplicationMenu(null);

    createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    // Clean up all temp files and watchers before quitting
    cleanupAllTempFiles();
});

// IPC Handlers

// Add file
ipcMain.handle("add-file", async (event) => {
    try {
        // Check if app is locked
        if (encryptionManager.getStatus().isLocked) {
            return {
                success: false,
                message: "App is locked. Please unlock first.",
            };
        }

        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            title: "Select a file to add",
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, message: "No file selected" };
        }

        const originalPath = result.filePaths[0];
        const originalFilename = path.basename(originalPath);
        const extension = getFileExtension(originalFilename);
        const format = getFileFormat(originalFilename);

        // Read file content
        const fileContent = fs.readFileSync(originalPath);

        // Encrypt content
        const encryptedData = encryptionManager.encryptContent(
            fileContent.toString("base64")
        );

        // Generate random filename for encrypted file
        const randomFilename = generateRandomFilename(".enc");
        const destinationPath = path.join(FILES_PATH, randomFilename);

        // Save encrypted data
        fs.writeFileSync(
            destinationPath,
            JSON.stringify(encryptedData, null, 2),
            "utf8"
        );

        // Get original file size for metadata
        const originalStats = fs.statSync(originalPath);

        // Update metadata
        const metadata = readMetadata();
        const fileEntry = {
            id: crypto.randomBytes(8).toString("hex"),
            originalName: originalFilename,
            storedName: randomFilename,
            format: format,
            extension: extension,
            size: originalStats.size,
            tags: [],
            dateAdded: new Date().toISOString(),
            path: destinationPath,
        };

        metadata.files.push(fileEntry);
        writeMetadata(metadata);

        return { success: true, file: fileEntry };
    } catch (error) {
        console.error("Error adding file:", error);
        return { success: false, message: error.message };
    }
});

// Get all files
ipcMain.handle("get-files", async () => {
    try {
        const metadata = readMetadata();
        return { success: true, files: metadata.files };
    } catch (error) {
        console.error("Error getting files:", error);
        return { success: false, message: error.message, files: [] };
    }
});

// Remove file
ipcMain.handle("remove-file", async (event, fileId) => {
    try {
        const metadata = readMetadata();
        const fileIndex = metadata.files.findIndex((f) => f.id === fileId);

        if (fileIndex === -1) {
            return { success: false, message: "File not found" };
        }

        const file = metadata.files[fileIndex];
        const filePath = path.join(FILES_PATH, file.storedName);

        // Delete physical file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from metadata
        metadata.files.splice(fileIndex, 1);
        writeMetadata(metadata);

        return { success: true };
    } catch (error) {
        console.error("Error removing file:", error);
        return { success: false, message: error.message };
    }
});

// Update tags
ipcMain.handle("update-tags", async (event, fileId, tags) => {
    try {
        const metadata = readMetadata();
        const file = metadata.files.find((f) => f.id === fileId);

        if (!file) {
            return { success: false, message: "File not found" };
        }

        file.tags = tags;
        writeMetadata(metadata);

        return { success: true, file };
    } catch (error) {
        console.error("Error updating tags:", error);
        return { success: false, message: error.message };
    }
});

// Open file
ipcMain.handle("open-file", async (event, fileId) => {
    try {
        // Check if app is locked
        if (encryptionManager.getStatus().isLocked) {
            return {
                success: false,
                message: "App is locked. Please unlock first.",
            };
        }

        const metadata = readMetadata();
        const file = metadata.files.find((f) => f.id === fileId);

        if (!file) {
            return { success: false, message: "File not found" };
        }

        const storedFilePath = path.join(FILES_PATH, file.storedName);

        if (!fs.existsSync(storedFilePath)) {
            return { success: false, message: "File does not exist on disk" };
        }

        // Decrypt file content (all files are encrypted by default)
        let fileContent;
        try {
            const encryptedData = JSON.parse(
                fs.readFileSync(storedFilePath, "utf8")
            );
            const decryptedContent =
                encryptionManager.decryptContent(encryptedData);
            fileContent = Buffer.from(decryptedContent, "base64");
        } catch (decryptError) {
            console.error("Error decrypting file:", decryptError);
            return {
                success: false,
                message: "Failed to decrypt file. It may be corrupted.",
            };
        }

        // Copy file to temp directory with original name
        const tempFilePath = path.join(TEMP_PATH, file.originalName);

        // If temp file already exists with same name, add timestamp to make it unique
        let finalTempPath = tempFilePath;
        if (fs.existsSync(tempFilePath)) {
            const timestamp = Date.now();
            const ext = path.extname(file.originalName);
            const nameWithoutExt = path.basename(file.originalName, ext);
            finalTempPath = path.join(
                TEMP_PATH,
                `${nameWithoutExt}_${timestamp}${ext}`
            );
        }

        // Write decrypted content to temp location
        fs.writeFileSync(finalTempPath, fileContent);

        // Track the temp file
        openedTempFiles.set(finalTempPath, {
            fileId: file.id,
            storedPath: storedFilePath,
            originalName: file.originalName,
            openedAt: Date.now(),
        });

        // Watch the temp file for changes or deletion
        const watcher = fs.watch(finalTempPath, (eventType) => {
            if (eventType === "rename") {
                // File was deleted or renamed (editor closed)
                cleanupTempFile(finalTempPath, watcher);
            }
        });

        // Store watcher reference
        if (openedTempFiles.has(finalTempPath)) {
            openedTempFiles.get(finalTempPath).watcher = watcher;
        }

        // Open file with default application
        const { shell } = require("electron");
        await shell.openPath(finalTempPath);

        return { success: true };
    } catch (error) {
        console.error("Error opening file:", error);
        return { success: false, message: error.message };
    }
});

// Show file in folder
ipcMain.handle("show-in-folder", async (event, fileId) => {
    try {
        const metadata = readMetadata();
        const file = metadata.files.find((f) => f.id === fileId);

        if (!file) {
            return { success: false, message: "File not found" };
        }

        const filePath = path.join(FILES_PATH, file.storedName);

        if (!fs.existsSync(filePath)) {
            return { success: false, message: "File does not exist on disk" };
        }

        const { shell } = require("electron");
        shell.showItemInFolder(filePath);

        return { success: true };
    } catch (error) {
        console.error("Error showing file in folder:", error);
        return { success: false, message: error.message };
    }
});

// Save file to another location
ipcMain.handle("save-file", async (event, fileId) => {
    try {
        // Check if app is locked
        if (encryptionManager.getStatus().isLocked) {
            return {
                success: false,
                message: "App is locked. Please unlock first.",
            };
        }

        const metadata = readMetadata();
        const file = metadata.files.find((f) => f.id === fileId);

        if (!file) {
            return { success: false, message: "File not found" };
        }

        const sourcePath = path.join(FILES_PATH, file.storedName);

        if (!fs.existsSync(sourcePath)) {
            return { success: false, message: "File does not exist on disk" };
        }

        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
            title: "Save File As",
            defaultPath: file.originalName,
            buttonLabel: "Save",
        });

        if (result.canceled || !result.filePath) {
            return { success: false, message: "Save canceled" };
        }

        const destinationPath = result.filePath;

        // Decrypt file content (all files are encrypted by default)
        let fileContent;
        try {
            const encryptedData = JSON.parse(
                fs.readFileSync(sourcePath, "utf8")
            );
            const decryptedContent =
                encryptionManager.decryptContent(encryptedData);
            fileContent = Buffer.from(decryptedContent, "base64");
        } catch (decryptError) {
            console.error("Error decrypting file:", decryptError);
            return {
                success: false,
                message: "Failed to decrypt file. It may be corrupted.",
            };
        }

        // Write decrypted file to the selected location
        fs.writeFileSync(destinationPath, fileContent);

        return { success: true, path: destinationPath };
    } catch (error) {
        console.error("Error saving file:", error);
        return { success: false, message: error.message };
    }
});

// Settings handlers

// Get settings
ipcMain.handle("get-settings", async () => {
    try {
        return { success: true, settings: currentSettings };
    } catch (error) {
        console.error("Error getting settings:", error);
        return {
            success: false,
            message: error.message,
            settings: DEFAULT_SETTINGS,
        };
    }
});

// Save settings (except storagePath - use change-storage-location for that)
ipcMain.handle("save-settings", async (event, settings) => {
    try {
        // Don't allow changing storagePath through this method
        const settingsToSave = {
            ...settings,
            storagePath: currentSettings.storagePath,
        };

        const success = saveSettingsToFile(settingsToSave);
        return { success };
    } catch (error) {
        console.error("Error saving settings:", error);
        return { success: false, message: error.message };
    }
});

// Change storage location
ipcMain.handle("change-storage-location", async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
            title: "Select Storage Location",
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, message: "No folder selected" };
        }

        const newStoragePath = path.join(result.filePaths[0], "synapse-data");
        const oldStoragePath = currentSettings.storagePath;

        // Check if it's the same location
        if (newStoragePath === oldStoragePath) {
            return { success: false, message: "Same location selected" };
        }

        return {
            success: true,
            path: newStoragePath,
            needsMigration: true,
            oldPath: oldStoragePath,
        };
    } catch (error) {
        console.error("Error changing storage location:", error);
        return { success: false, message: error.message };
    }
});

// Start migration process
ipcMain.handle("start-migration", async (event, oldPath, newPath) => {
    try {
        const result = await migrateData(oldPath, newPath, (progress) => {
            // Send progress updates to renderer
            if (mainWindow) {
                mainWindow.webContents.send("migration-progress", progress);
            }
        });

        if (result.success) {
            // Update settings with new path
            const updatedSettings = {
                ...currentSettings,
                storagePath: newPath,
            };

            saveSettingsToFile(updatedSettings);

            // Update storage paths
            initializeStoragePaths(newPath);
        }

        return result;
    } catch (error) {
        console.error("Error during migration:", error);
        return { success: false, message: error.message };
    }
});

// Encryption/Security handlers

// Quit application (for password dialog)
ipcMain.handle("quit-app", async () => {
    app.quit();
});

// Get encryption status
ipcMain.handle("get-encryption-status", async () => {
    try {
        const status = encryptionManager.getStatus();
        return { success: true, ...status };
    } catch (error) {
        console.error("Error getting encryption status:", error);
        return { success: false, message: error.message };
    }
});

// Set or change encryption password
ipcMain.handle(
    "set-encryption-password",
    async (event, newPassword, oldPassword) => {
        try {
            const result = await encryptionManager.setPassword(
                newPassword,
                oldPassword
            );

            if (result.success) {
                // If successfully set password, re-encrypt all existing files
                // This will be triggered from renderer with progress tracking
                return { success: true, needsReEncryption: true };
            }

            return result;
        } catch (error) {
            console.error("Error setting encryption password:", error);
            return { success: false, message: error.message };
        }
    }
);

// Remove encryption password
ipcMain.handle("remove-encryption-password", async (event, password) => {
    try {
        const result = await encryptionManager.removePassword(password);

        if (result.success) {
            // Password removed, master key now in plaintext
            return { success: true };
        }

        return result;
    } catch (error) {
        console.error("Error removing encryption password:", error);
        return { success: false, message: error.message };
    }
});

// Lock application
ipcMain.handle("lock-app", async () => {
    try {
        const result = await encryptionManager.lock();
        return result;
    } catch (error) {
        console.error("Error locking app:", error);
        return { success: false, message: error.message };
    }
});

// Unlock application
ipcMain.handle("unlock-app", async (event, password) => {
    try {
        const result = await encryptionManager.unlock(password);
        return result;
    } catch (error) {
        console.error("Error unlocking app:", error);
        return { success: false, message: error.message };
    }
});

// Re-encrypt all files with new key (called when password is changed)
ipcMain.handle("re-encrypt-all-files", async (event) => {
    try {
        const metadata = readMetadata();
        const totalFiles = metadata.files.length;

        // Total items = files + metadata
        const totalItems = totalFiles + 1;
        let itemsProcessed = 0;
        const errors = [];

        // Re-encrypt all files
        for (const file of metadata.files) {
            try {
                const storedFilePath = path.join(FILES_PATH, file.storedName);

                if (!fs.existsSync(storedFilePath)) {
                    errors.push(`File not found: ${file.originalName}`);
                    itemsProcessed++;
                    continue;
                }

                // Read and decrypt with current key (before password change)
                const encryptedData = JSON.parse(
                    fs.readFileSync(storedFilePath, "utf8")
                );
                const decryptedContent =
                    encryptionManager.decryptContent(encryptedData);

                // Re-encrypt with new key
                const newEncryptedData =
                    encryptionManager.encryptContent(decryptedContent);

                // Save back
                fs.writeFileSync(
                    storedFilePath,
                    JSON.stringify(newEncryptedData, null, 2),
                    "utf8"
                );

                itemsProcessed++;

                // Send progress update
                if (mainWindow) {
                    mainWindow.webContents.send("re-encryption-progress", {
                        current: itemsProcessed,
                        total: totalItems,
                        percentage: Math.round(
                            (itemsProcessed / totalItems) * 100
                        ),
                    });
                }
            } catch (fileError) {
                console.error(
                    `Error re-encrypting file ${file.originalName}:`,
                    fileError
                );
                errors.push(`${file.originalName}: ${fileError.message}`);
                itemsProcessed++;
            }
        }

        // Re-encrypt metadata
        try {
            writeMetadata(metadata);
            itemsProcessed++;

            // Send final progress update
            if (mainWindow) {
                mainWindow.webContents.send("re-encryption-progress", {
                    current: itemsProcessed,
                    total: totalItems,
                    percentage: 100,
                });
            }
        } catch (metadataError) {
            console.error("Error re-encrypting metadata:", metadataError);
            errors.push(`Metadata: ${metadataError.message}`);
        }

        return {
            success: errors.length === 0,
            filesProcessed: itemsProcessed,
            totalFiles: totalItems,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error("Error re-encrypting files:", error);
        return { success: false, message: error.message };
    }
});

// Open external link in system browser
ipcMain.handle("open-external-link", async (event, url) => {
    try {
        const { shell } = require("electron");
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error("Error opening external link:", error);
        return { success: false, message: error.message };
    }
});

// Get app version from package.json
ipcMain.handle("get-app-version", async () => {
    try {
        return { success: true, version: app.getVersion() };
    } catch (error) {
        console.error("Error getting app version:", error);
        return { success: false, message: error.message };
    }
});
