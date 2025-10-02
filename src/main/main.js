const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Store data paths
const APP_DATA_PATH = path.join(app.getPath("userData"), "synapse-data");
const FILES_PATH = path.join(APP_DATA_PATH, "files");
const METADATA_PATH = path.join(APP_DATA_PATH, "metadata.json");
const SETTINGS_PATH = path.join(APP_DATA_PATH, "settings.json");

let mainWindow;

// Default settings
const DEFAULT_SETTINGS = {
    theme: "dark",
    language: "en",
    storagePath: APP_DATA_PATH,
};

// Initialize data directories
function initializeDataDirectories() {
    if (!fs.existsSync(APP_DATA_PATH)) {
        fs.mkdirSync(APP_DATA_PATH, { recursive: true });
    }
    if (!fs.existsSync(FILES_PATH)) {
        fs.mkdirSync(FILES_PATH, { recursive: true });
    }
    if (!fs.existsSync(METADATA_PATH)) {
        fs.writeFileSync(METADATA_PATH, JSON.stringify({ files: [] }, null, 2));
    }
    if (!fs.existsSync(SETTINGS_PATH)) {
        fs.writeFileSync(
            SETTINGS_PATH,
            JSON.stringify(DEFAULT_SETTINGS, null, 2)
        );
    }
}

// Read metadata
function readMetadata() {
    try {
        const data = fs.readFileSync(METADATA_PATH, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading metadata:", error);
        return { files: [] };
    }
}

// Write metadata
function writeMetadata(metadata) {
    try {
        fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
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
    });

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

    // Open DevTools in development mode
    if (process.argv.includes("--dev")) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    initializeDataDirectories();

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

// IPC Handlers

// Add file
ipcMain.handle("add-file", async (event) => {
    try {
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
        const randomFilename = generateRandomFilename(extension);
        const destinationPath = path.join(FILES_PATH, randomFilename);

        // Copy file
        fs.copyFileSync(originalPath, destinationPath);

        // Get file stats
        const stats = fs.statSync(destinationPath);

        // Update metadata
        const metadata = readMetadata();
        const fileEntry = {
            id: crypto.randomBytes(8).toString("hex"),
            originalName: originalFilename,
            storedName: randomFilename,
            format: format,
            extension: extension,
            size: stats.size,
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
        const metadata = readMetadata();
        const file = metadata.files.find((f) => f.id === fileId);

        if (!file) {
            return { success: false, message: "File not found" };
        }

        const filePath = path.join(FILES_PATH, file.storedName);

        if (!fs.existsSync(filePath)) {
            return { success: false, message: "File does not exist on disk" };
        }

        // Open file with default application
        const { shell } = require("electron");
        await shell.openPath(filePath);

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

// Settings handlers

// Get settings
ipcMain.handle("get-settings", async () => {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) {
            fs.writeFileSync(
                SETTINGS_PATH,
                JSON.stringify(DEFAULT_SETTINGS, null, 2)
            );
            return { success: true, settings: DEFAULT_SETTINGS };
        }

        const data = fs.readFileSync(SETTINGS_PATH, "utf8");
        const settings = JSON.parse(data);

        // Merge with default settings to ensure all properties exist
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

        return { success: true, settings: mergedSettings };
    } catch (error) {
        console.error("Error getting settings:", error);
        return {
            success: false,
            message: error.message,
            settings: DEFAULT_SETTINGS,
        };
    }
});

// Save settings
ipcMain.handle("save-settings", async (event, settings) => {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return { success: true };
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

        const newStoragePath = result.filePaths[0];

        // Note: Changing storage location requires app restart
        // You could add migration logic here if needed

        return { success: true, path: newStoragePath };
    } catch (error) {
        console.error("Error changing storage location:", error);
        return { success: false, message: error.message };
    }
});
