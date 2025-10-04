<div align="center">
    <img src="https://raw.githubusercontent.com/Davidasx/Synapse/refs/heads/main/src/renderer/icon.svg" width="128" height="128" alt="Synapse Logo">
</div>


# Synapse

A smart and privacy-first file management application built with Electron.

## Features

-   File encryption and password protection
-   Local storage of files and metadata
-   Manual tagging system for organizing files
-   AI-powered tag generation using OpenAI API (optional)
-   Category-based filtering (Documents, Images, Videos, Audio, Archives, Code, Other)
-   File count badges on category filters
-   Category-specific statistics
-   Search files by:
    -   File name
    -   Tags
    -   File format
-   Multi-language support (English, 简体中文)
-   Dark/Light theme support

## Installation

```bash
npm install
```

## Development

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Building

```bash
# Install dependencies (including electron-builder)
npm install

# Build for your current platform
npm run build

# Or build for a specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Future Enhancements

-   Advanced search capabilities
-   File preview
-   Batch operations
-   Cloud backup (optional)
-   File versioning
