# Shakespeare - AI-Powered Nostr Website Builder

Shakespeare is an AI chat application that allows users to build custom Nostr websites through natural language conversation. Simply describe what you want to build, and AI will help you create it.

## Features

- **AI-Powered Development**: Chat with an AI assistant to build your Nostr website
- **File Attachments**: Attach files directly to chat messages for AI processing
- **Project Management**: Create and manage multiple projects with sidebar navigation
- **Real-time Editing**: Edit files directly in the browser with syntax highlighting
- **File Explorer**: Browse and manage your project files
- **Project Preview**: Preview your website as you build it
- **Template Cloning**: Start from a pre-configured Nostr template

## Getting Started

1. **Create a Project**: Enter a description of what you want to build in the prompt textarea
2. **Chat with AI**: Use the AI assistant to add features, edit files, and build your website
3. **Attach Files**: Click the paperclip icon to attach files to your messages for AI analysis
4. **Edit Code**: Switch to the code view to manually edit files if needed
5. **Preview**: View your website in the preview pane

## Project Structure

Each project includes:
- React 18 with TypeScript
- Vite for building
- TailwindCSS for styling
- Nostrify for Nostr integration
- shadcn/ui components

## AI Capabilities

The AI assistant can:
- Read and write project files
- Add new components and pages
- Configure Nostr functionality
- Build the project
- Search through files
- Provide project structure overview
- Add and remove npm packages
- Install dependencies and dev dependencies

## Usage

1. **Homepage**: Enter a project description in the textarea to create new projects, with existing projects listed in the sidebar
2. **Project View**: Split-pane interface with AI chat on the left and preview/code on the right
3. **File Explorer**: Navigate your project files in the code view
4. **File Editor**: Edit files with syntax highlighting and save changes

## Git Integration

Shakespeare includes full Git functionality with credential management:

### Features
- **Version Control**: Full Git repository support with commit history and branch management
- **Global Credentials**: Configure Git credentials once and use them across all projects
- **Automatic Matching**: Credentials are automatically matched to repository origins
- **Popular Providers**: Built-in support for GitHub, GitLab, and custom Git providers
- **Secure Storage**: Credentials are stored locally in your browser using IndexedDB

### Setting Up Git Credentials

1. **Access Git Settings**: Click the gear icon in any Git dialog or use the Git Settings option
2. **Add Provider**: Choose from GitHub, GitLab, or add a custom Git provider
3. **Enter Token**: Use your username and personal access token for authentication
4. **Automatic Usage**: Credentials are automatically used for push/pull operations in matching repositories

### Repository Operations

- **Push/Pull**: Sync changes with remote repositories using configured credentials
- **Status Monitoring**: Real-time Git status with file changes and sync information
- **Commit History**: View commit history and repository information
- **Branch Management**: Work with different branches and track remote changes

## Development

Built with:
- React 18
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- LightningFS for filesystem
- isomorphic-git for template cloning