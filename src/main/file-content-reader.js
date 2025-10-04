const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");

/**
 * Extract text content from various file formats
 * @param {string} filePath - Path to the file
 * @param {string} format - File format/extension
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function extractFileContent(filePath, format) {
    try {
        const ext = path.extname(filePath).toLowerCase();

        // Plain text files
        const plainTextExtensions = [
            ".txt",
            ".md",
            ".json",
            ".xml",
            ".html",
            ".css",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".py",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
            ".cs",
            ".php",
            ".rb",
            ".go",
            ".rs",
            ".swift",
            ".kt",
            ".scala",
            ".sh",
            ".bash",
            ".yaml",
            ".yml",
            ".toml",
            ".ini",
            ".cfg",
            ".conf",
            ".log",
            ".csv",
            ".sql",
        ];

        if (plainTextExtensions.includes(ext)) {
            const content = fs.readFileSync(filePath, "utf8");
            return { success: true, content };
        }

        // DOCX files
        if (ext === ".docx") {
            const result = await mammoth.extractRawText({ path: filePath });
            return { success: true, content: result.value };
        }

        // RTF files - basic RTF text extraction
        if (ext === ".rtf") {
            const rtfContent = fs.readFileSync(filePath, "utf8");
            // Simple RTF text extraction - remove RTF control codes
            // This is a basic implementation - more complex RTF files may need a library
            const textContent = rtfContent
                .replace(/\\[a-z]+\-?\d* ?/g, "") // Remove control words
                .replace(/[{}]/g, "") // Remove braces
                .replace(/\\\\/g, "\\") // Unescape backslashes
                .replace(/\\'/g, "'") // Unescape quotes
                .trim();

            return { success: true, content: textContent };
        }

        // Unsupported file types
        if (ext === ".pdf") {
            return {
                success: false,
                error: "PDF files require OCR processing and are not currently supported. Please use a PDF to text converter.",
            };
        }

        // Unknown or unsupported file types
        const imageExtensions = [
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".bmp",
            ".svg",
            ".webp",
        ];
        const videoExtensions = [
            ".mp4",
            ".avi",
            ".mov",
            ".mkv",
            ".webm",
            ".flv",
        ];
        const audioExtensions = [
            ".mp3",
            ".wav",
            ".ogg",
            ".flac",
            ".aac",
            ".m4a",
        ];

        if (imageExtensions.includes(ext)) {
            return {
                success: false,
                error: "Image files cannot be processed for text content. OCR is not currently supported.",
            };
        }

        if (videoExtensions.includes(ext)) {
            return {
                success: false,
                error: "Video files cannot be processed for text content.",
            };
        }

        if (audioExtensions.includes(ext)) {
            return {
                success: false,
                error: "Audio files cannot be processed for text content. Speech-to-text is not currently supported.",
            };
        }

        return {
            success: false,
            error: `File type ${ext} is not supported for content extraction.`,
        };
    } catch (error) {
        console.error("Error extracting file content:", error);
        return {
            success: false,
            error: `Failed to extract content: ${error.message}`,
        };
    }
}

module.exports = { extractFileContent };
