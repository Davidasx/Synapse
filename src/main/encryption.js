const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { app } = require("electron");

/**
 * Encryption Manager for Synapse
 * Implements a two-layer encryption system:
 * 1. Master key encrypts/decrypts all file contents
 * 2. Password (if set) encrypts the master key itself
 *
 * Security levels:
 * - No password: Master key stored in plaintext, files encrypted (prevents casual access)
 * - With password: Master key encrypted with password-derived key, files encrypted (secure)
 */

class EncryptionManager {
    constructor() {
        this.masterKey = null; // The key used to encrypt/decrypt files
        this.isLocked = false; // Whether the app is currently locked
        this.hasPassword = false; // Whether a password is set
        this.keyFilePath = path.join(app.getPath("userData"), "master.key");
        this.configPath = path.join(app.getPath("userData"), "encryption.json");
    }

    /**
     * Initialize encryption system
     * Called on app startup
     */
    async initialize() {
        try {
            // Check if master key exists
            const keyExists = await this._fileExists(this.keyFilePath);
            const configExists = await this._fileExists(this.configPath);

            if (keyExists && configExists) {
                // Load existing configuration
                const config = JSON.parse(
                    await fs.readFile(this.configPath, "utf8")
                );
                this.hasPassword = config.hasPassword || false;

                if (!this.hasPassword) {
                    // No password set, load key directly
                    const keyData = await fs.readFile(this.keyFilePath, "utf8");
                    this.masterKey = Buffer.from(keyData, "hex");
                    this.isLocked = false;
                } else {
                    // Password is set, app starts locked
                    this.isLocked = true;
                }
            } else {
                // First run, generate new master key
                await this._generateAndSaveMasterKey();
                this.hasPassword = false;
                this.isLocked = false;
            }

            return {
                success: true,
                isLocked: this.isLocked,
                hasPassword: this.hasPassword,
            };
        } catch (error) {
            console.error("Failed to initialize encryption:", error);
            throw error;
        }
    }

    /**
     * Generate a new master key and save it (unencrypted initially)
     */
    async _generateAndSaveMasterKey() {
        // Generate a 256-bit (32-byte) random key
        this.masterKey = crypto.randomBytes(32);

        // Save key as hex string
        await fs.writeFile(
            this.keyFilePath,
            this.masterKey.toString("hex"),
            "utf8"
        );

        // Save configuration
        await this._saveConfig();
    }

    /**
     * Save encryption configuration
     */
    async _saveConfig() {
        const config = {
            hasPassword: this.hasPassword,
            version: 1,
        };
        await fs.writeFile(
            this.configPath,
            JSON.stringify(config, null, 2),
            "utf8"
        );
    }

    /**
     * Set or change password
     * This will re-encrypt the master key and all files
     */
    async setPassword(newPassword, oldPassword = null) {
        try {
            // If changing password, verify old password first
            if (this.hasPassword && oldPassword) {
                const unlocked = await this.unlock(oldPassword);
                if (!unlocked.success) {
                    return { success: false, error: "Invalid old password" };
                }
            }

            // Ensure master key is available
            if (!this.masterKey) {
                return { success: false, error: "Master key not available" };
            }

            // Derive key from password using PBKDF2
            const salt = crypto.randomBytes(32);
            const passwordKey = crypto.pbkdf2Sync(
                newPassword,
                salt,
                100000,
                32,
                "sha256"
            );

            // Encrypt master key with password-derived key
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(
                "aes-256-gcm",
                passwordKey,
                iv
            );

            const encryptedKey = Buffer.concat([
                cipher.update(this.masterKey),
                cipher.final(),
            ]);

            const authTag = cipher.getAuthTag();

            // Save encrypted key and metadata
            const keyData = {
                encrypted: encryptedKey.toString("hex"),
                iv: iv.toString("hex"),
                salt: salt.toString("hex"),
                authTag: authTag.toString("hex"),
            };

            await fs.writeFile(
                this.keyFilePath,
                JSON.stringify(keyData, null, 2),
                "utf8"
            );

            // Update configuration
            this.hasPassword = true;
            await this._saveConfig();

            return { success: true };
        } catch (error) {
            console.error("Failed to set password:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove password protection
     * Master key will be stored in plaintext
     */
    async removePassword(password) {
        try {
            // Verify password and unlock
            const unlocked = await this.unlock(password);
            if (!unlocked.success) {
                return { success: false, error: "Invalid password" };
            }

            // Save master key in plaintext
            await fs.writeFile(
                this.keyFilePath,
                this.masterKey.toString("hex"),
                "utf8"
            );

            // Update configuration
            this.hasPassword = false;
            this.isLocked = false;
            await this._saveConfig();

            return { success: true };
        } catch (error) {
            console.error("Failed to remove password:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Lock the application
     */
    async lock() {
        if (!this.hasPassword) {
            return { success: false, error: "No password set" };
        }

        this.isLocked = true;
        this.masterKey = null; // Clear master key from memory

        return { success: true };
    }

    /**
     * Unlock the application with password
     */
    async unlock(password) {
        try {
            if (!this.hasPassword) {
                return { success: false, error: "No password set" };
            }

            // Read encrypted key data
            const keyDataStr = await fs.readFile(this.keyFilePath, "utf8");
            const keyData = JSON.parse(keyDataStr);

            // Derive key from password
            const salt = Buffer.from(keyData.salt, "hex");
            const passwordKey = crypto.pbkdf2Sync(
                password,
                salt,
                100000,
                32,
                "sha256"
            );

            // Decrypt master key
            const iv = Buffer.from(keyData.iv, "hex");
            const encryptedKey = Buffer.from(keyData.encrypted, "hex");
            const authTag = Buffer.from(keyData.authTag, "hex");

            const decipher = crypto.createDecipheriv(
                "aes-256-gcm",
                passwordKey,
                iv
            );
            decipher.setAuthTag(authTag);

            this.masterKey = Buffer.concat([
                decipher.update(encryptedKey),
                decipher.final(),
            ]);

            this.isLocked = false;

            return { success: true };
        } catch (error) {
            console.error("Failed to unlock:", error);
            return {
                success: false,
                error: "Invalid password or corrupted key file",
            };
        }
    }

    /**
     * Encrypt file content
     */
    encryptContent(content) {
        if (this.isLocked || !this.masterKey) {
            throw new Error("App is locked or master key not available");
        }

        // Generate a random IV for this content
        const iv = crypto.randomBytes(16);

        // Create cipher
        const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);

        // Encrypt content
        const encrypted = Buffer.concat([
            cipher.update(Buffer.from(content, "utf8")),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        // Return encrypted data with metadata
        return {
            encrypted: encrypted.toString("base64"),
            iv: iv.toString("hex"),
            authTag: authTag.toString("hex"),
            version: 1,
        };
    }

    /**
     * Decrypt file content
     */
    decryptContent(encryptedData) {
        if (this.isLocked || !this.masterKey) {
            throw new Error("App is locked or master key not available");
        }

        try {
            // Parse encrypted data
            const encrypted = Buffer.from(encryptedData.encrypted, "base64");
            const iv = Buffer.from(encryptedData.iv, "hex");
            const authTag = Buffer.from(encryptedData.authTag, "hex");

            // Create decipher
            const decipher = crypto.createDecipheriv(
                "aes-256-gcm",
                this.masterKey,
                iv
            );
            decipher.setAuthTag(authTag);

            // Decrypt content
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final(),
            ]);

            return decrypted.toString("utf8");
        } catch (error) {
            console.error("Failed to decrypt content:", error);
            throw new Error(
                "Failed to decrypt content. File may be corrupted."
            );
        }
    }

    /**
     * Check if a file exists
     */
    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get current encryption status
     */
    getStatus() {
        return {
            isLocked: this.isLocked,
            hasPassword: this.hasPassword,
            isInitialized: this.masterKey !== null || this.isLocked,
        };
    }
}

// Export singleton instance
module.exports = new EncryptionManager();
