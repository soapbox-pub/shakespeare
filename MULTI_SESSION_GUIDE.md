# Multi-Session AI Management System

Shakespeare now supports multiple AI agent sessions running concurrently across different projects without interruption. This guide explains how the system works and how to use it effectively.

## Overview

The multi-session system allows you to:
- **Run multiple AI sessions simultaneously** across different projects
- **Background processing** - AI agents continue working even when you switch to other projects
- **Session persistence** - Sessions are automatically saved and restored across browser sessions
- **Real-time monitoring** - Track all active sessions with live status indicators
- **Smart notifications** - Get notified when background sessions complete

## Key Components

### SessionManager
The core class that manages all AI sessions globally:
- Handles session creation, deletion, and state management
- Manages AI generation loops for multiple sessions
- Provides event-based communication between sessions and UI
- Persists session state to localStorage for browser session recovery

### SessionManagerProvider
React context provider that creates and manages the global SessionManager instance:
- Automatically initializes on app startup
- Provides session manager to all components via context
- Handles cleanup on app shutdown

### useAIChatSession Hook
Enhanced hook that replaces the original `useAIChat` hook:
- Integrates with the global session manager
- Automatically creates or reuses sessions for projects
- Maintains backward compatibility with existing chat components

### SessionStatusIndicator
Visual component that shows active session status in the sidebar header:
- Displays total number of active sessions
- Shows how many sessions are currently processing
- Provides popover with detailed session information
- Allows stopping or deleting sessions directly from the UI

### ProjectSessionIndicator
Small visual indicator next to project names in the sidebar:
- Shows a spinning loader when AI is actively processing
- Shows a green dot when session exists but is idle
- Hidden when no session exists for that project

### SessionMonitor
Background component that monitors session state:
- Shows toast notifications when background sessions complete
- Provides navigation links to completed sessions
- Only notifies for sessions not currently being viewed

## How It Works

### Session Creation
When you open a project:
1. The system checks if an active session already exists for that project
2. If found, it reuses the existing session (preserving message history)
3. If not found, it creates a new session and loads the last saved history from `.ai/history/`

### Background Processing
When you switch projects:
1. The current session continues running in the background
2. AI generation, tool execution, and file operations continue uninterrupted
3. Session state is continuously updated and persisted
4. You can monitor progress via the SessionStatusIndicator

### Session Persistence
Sessions are automatically saved to localStorage:
- Message history is preserved across browser restarts
- Session configuration and state are restored
- Active sessions resume from where they left off

### Notifications
When a background session completes:
- A toast notification appears with the project name
- Clicking "View" navigates directly to that project
- Notifications only appear for sessions you're not currently viewing

## Using the System

### Basic Usage
The multi-session system works transparently with existing functionality:
- Start AI conversations as usual - sessions are created automatically
- Switch between projects freely - sessions persist in the background
- **Messages stream in real-time** - see AI responses as they happen, even when switching projects
- **Stop generation directly** - use the stop button in the chat interface, no need to click indicators
- Monitor active sessions via the status indicator in the sidebar

### Session Status Indicator
Located in the sidebar header, shows:
- **Number badge**: Total active sessions
- **Blue badge**: Currently processing sessions
- **Spinner icon**: When any session is active
- **Click to expand**: Detailed view of all sessions with management controls

### Project Session Indicators
Visual indicators next to project names in the sidebar:
- **Spinning loader**: AI is actively processing for this project
- **Green dot**: Session exists but is currently idle
- **No indicator**: No active session for this project

### Real-Time Chat Streaming
- **Live updates**: Messages stream directly to the chat interface in real-time
- **Cross-project visibility**: See AI responses even when viewing other projects
- **Immediate control**: Stop generation using the stop button in the chat interface
- **No manual refresh needed**: UI updates automatically as sessions progress

### Session Management
From the SessionStatusIndicator popover:
- **View session details**: Project name, message count, last activity
- **Stop processing**: Cancel ongoing AI generation
- **Delete session**: Remove session completely
- **Navigate**: Click project name to switch to that session

### Monitoring Background Work
- Sessions show real-time status updates
- Progress is visible even when working on other projects
- Streaming content and tool execution continue in background
- Keep-alive system prevents browser throttling during AI processing

## Technical Implementation

### Architecture
```
App
├── SessionManagerProvider
│   ├── SessionManager (global state)
│   ├── SessionMonitor (notifications)
│   └── Components
│       ├── ChatPane (uses useAIChatSession)
│       └── SessionStatusIndicator
```

### Session Lifecycle
1. **Creation**: Project opened → Session created/restored
2. **Active**: AI processing, tool execution, message handling
3. **Background**: Project switched → Session continues processing
4. **Persistence**: State saved to localStorage continuously
5. **Restoration**: Browser restart → Sessions restored from localStorage
6. **Cleanup**: Project deleted → Associated sessions removed

### Event System
The SessionManager uses an event-driven architecture:
- `sessionCreated`: New session initialized
- `sessionUpdated`: Session state changed
- `sessionDeleted`: Session removed
- `messageAdded`: New message in session
- `streamingUpdate`: Real-time AI response updates
- `loadingChanged`: Processing status changed

### Performance Considerations
- Sessions run independently without blocking each other
- Background sessions use minimal resources when idle
- Keep-alive system only activates during AI processing
- localStorage persistence is throttled to avoid excessive writes

## Migration from Single Session

The new system is fully backward compatible:
- Existing `ChatPane` components work without changes
- Message history is preserved and migrated automatically
- All existing AI functionality continues to work
- No breaking changes to the API

### Key Differences
- Sessions persist across project switches
- Multiple AI agents can work simultaneously
- Background processing continues uninterrupted
- Global session monitoring and management

## Best Practices

### For Users
1. **Monitor active sessions** via the status indicator
2. **Let background sessions complete** before closing the browser
3. **Use notifications** to track progress on multiple projects
4. **Clean up unused sessions** to maintain performance

### For Developers
1. **Use useAIChatSession** instead of useAIChat for new components
2. **Subscribe to session events** for custom integrations
3. **Handle session cleanup** when projects are deleted
4. **Consider session limits** for resource management

## Troubleshooting

### Common Issues
- **Sessions not persisting**: Check localStorage permissions
- **Background processing stopped**: Verify keep-alive audio permissions
- **Memory usage high**: Clean up old sessions via the status indicator
- **Notifications not showing**: Ensure toast permissions are enabled

### Debug Information
- Session state is logged to browser console
- SessionManager events can be monitored for debugging
- localStorage key: `shakespeare:sessions`
- Error handling includes graceful degradation

## Future Enhancements

Planned improvements include:
- Session resource limits and automatic cleanup
- Cross-tab session synchronization
- Enhanced session analytics and metrics
- Batch operations across multiple sessions
- Session templates and presets