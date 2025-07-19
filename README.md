# CMVC Source Control Extension

A VSCode extension that provides a Git-like interface for CMVC (Configuration Management Version Control) operations.

## Features

- **Configuration Management**: Set Family, Release, and Defect values that are used throughout the extension
- **File Operations**: Checkin, Checkout, and View files using CMVC commands
- **File Explorer**: Browse all files in the current workspace with tree structure and real-time updates
- **Track View**: Placeholder for future track functionality

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile the TypeScript code
4. Press F5 in VSCode to launch the extension in a new Extension Development Host window

## Usage

### Setting Configuration Values

1. Open the CMVC view in the primary sidebar
2. Click on the configuration items (Family, Release, Defect) to set their values
3. These values will be used for all CMVC operations

### File Operations

1. Browse files in the tree structure - directories can be expanded/collapsed
2. Right-click on any file in the file explorer
3. Choose from the following options:
   - **Checkin**: Check in the file with current Family, Release, and Defect values
   - **Checkout**: Check out the file with current Family, Release, and Defect values
   - **View**: View the file contents using CMVC view command

**Note**: The file explorer automatically updates when files or directories are added, removed, or modified in the workspace.

### Commands

The extension executes the following CMVC commands:

- `File -checkin <filename> -defect <Defect> -release <Release> -family <Family>`
- `File -checkout <filename> -defect <Defect> -release <Release> -family <Family>`
- `File -view <filename> -release <Release> -family <Family>`

## Development

### Prerequisites

- Node.js
- VSCode
- TypeScript

### Building

#### Using Make (Recommended)
```bash
make build          # Build the extension
make watch          # Start watch mode for development
make clean          # Clean build artifacts
make rebuild        # Quick rebuild (skips npm install if not needed)
```

#### Using npm directly
```bash
npm install
npm run compile
```

### Running

Press F5 in VSCode to launch the extension in debug mode.

### Development Workflow

```bash
make dev             # Build and prepare for debugging
make watch           # Start watch mode for continuous development
make clean           # Clean build artifacts when needed
make rebuild         # Quick rebuild during development
```

## Configuration

The extension stores configuration values in the workspace settings under the `cmvc` namespace:

- `cmvc.family`: The Family value
- `cmvc.release`: The Release value  
- `cmvc.defect`: The Defect value

## Packaging

To create a distributable extension package:

```bash
make install-vsce    # Install vsce packaging tool
make package         # Create .vsix file
```

## Known Issues

- None currently known

## Future Enhancements

- Track view functionality
- File status indicators
- Batch operations
- Integration with CMVC status commands 