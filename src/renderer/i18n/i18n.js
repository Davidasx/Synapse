// i18n Loader Module
// This module handles loading and managing translations

const i18n = {
    currentLanguage: "en",
    translations: {},

    // Initialize i18n with a language
    async init(language = "en") {
        this.currentLanguage = language;
        await this.loadLanguage(language);
    },

    // Load a language file
    async loadLanguage(language) {
        try {
            const response = await fetch(`i18n/${language}.json`);
            if (!response.ok) {
                console.error(`Failed to load language file: ${language}.json`);
                // Fallback to English
                if (language !== "en") {
                    return this.loadLanguage("en");
                }
                return;
            }
            this.translations = await response.json();
            this.currentLanguage = language;
        } catch (error) {
            console.error(`Error loading language ${language}:`, error);
            // Fallback to English if not already trying English
            if (language !== "en") {
                return this.loadLanguage("en");
            }
        }
    },

    // Get translation for a key
    t(key) {
        return this.translations[key] || key;
    },

    // Apply translations to the DOM
    applyTranslations() {
        // Update document title
        document.title = this.t("pageTitle");

        // Update all elements with data-i18n attribute
        document.querySelectorAll("[data-i18n]").forEach((element) => {
            const key = element.getAttribute("data-i18n");
            // Check if the element has a .filter-label child (for filter chips)
            const labelElement = element.querySelector(".filter-label");
            if (labelElement) {
                labelElement.textContent = this.t(key);
            } else {
                element.textContent = this.t(key);
            }
        });

        // Update all elements with data-i18n-placeholder attribute
        document
            .querySelectorAll("[data-i18n-placeholder]")
            .forEach((element) => {
                const key = element.getAttribute("data-i18n-placeholder");
                element.placeholder = this.t(key);
            });
    },

    // Change language
    async changeLanguage(language) {
        await this.loadLanguage(language);
        this.applyTranslations();
    },
};

// Export for use in other modules
window.i18n = i18n;
