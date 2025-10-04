# Synapse

A smart and privacy-first file management application built with Electron.

## Features

-   Add files to your personal library
-   Files are stored locally with privacy-first approach
-   Manual tagging system for organizing files
-   Category-based filtering (Documents, Images, Videos, Audio, Archives, Code, Other)
-   File count badges on category filters
-   Category-specific statistics
-   Search files by:
    -   File name
    -   Tags
    -   File format
-   Smart file naming (prevents duplicates using random identifiers)
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

## How It Works

1. When you add a file, it's copied to a local storage directory
2. Files are renamed with a random identifier to prevent duplicates
3. Original filename, tags, and metadata are stored separately
4. Search and filter your files using multiple criteria
5. Files are categorized automatically based on their format
6. All data stays local - no cloud, no tracking

## Future Enhancements

-   AI-powered automatic tagging
-   Advanced search capabilities
-   File preview
-   Batch operations
-   Cloud backup (optional)
-   File versioning
