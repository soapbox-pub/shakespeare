# Context Compression

Shakespeare includes automatic context compression to manage token usage and prevent context window overflow during long AI chat sessions.

## How It Works

### Trigger Conditions

Context compression is automatically triggered when ALL of the following conditions are met:

1. **User has replied to an existing chat** - The last user message is not the first message in the session
2. **AI responds with tool calls** - The AI's first response to the user's message contains tool calls (indicating active building/development)
3. **Not already compressing** - Prevents duplicate compression operations

### Compression Process

When triggered, the system:

1. **Identifies messages to summarize** - All messages up to (but excluding) the last user message
2. **Generates a summary** - Uses the same AI model to create a concise summary of the conversation
3. **Creates compressed history** - Replaces old messages with a single system message containing the summary
4. **Preserves recent context** - Keeps the last user message and all subsequent messages intact
5. **Saves to filesystem only** - Updates the `.git/ai/history/*.jsonl` file without affecting the UI

### Summary Quality

The AI summarizer is instructed to:
- Capture key decisions, features implemented, and important context
- Preserve technical details (file paths, package names, configuration changes)
- Write in a clear, factual style
- Focus on what was built and what the user wants
- Be concise but comprehensive enough for seamless continuation

### User Experience

**During the session:**
- No visible changes to the chat interface
- All messages remain visible as before
- Compression happens silently in the background

**After navigation:**
- When returning to the project, the compressed history is loaded
- The chat shows: `[Summary] → [Recent messages]`
- The AI has full context from the summary plus recent messages

## Implementation Details

### Files Involved

- **`src/lib/summarizeMessages.ts`** - Core summarization logic
- **`src/lib/SessionManager.ts`** - Compression trigger and orchestration
- **`src/lib/DotAI.ts`** - File system persistence

### Key Code Locations

**Compression Trigger** (`SessionManager.ts`):
```typescript
// After first assistant message with tool calls
if (
  isFirstResponse &&
  accumulatedToolCalls.length > 0 &&
  session.lastUserMessageIndex > 0 &&
  !session.isCompressing
) {
  this.compressSessionContext(projectId, session.lastUserMessageIndex, providerModel);
}
```

**Compression Method** (`SessionManager.ts`):
```typescript
private async compressSessionContext(
  projectId: string,
  lastUserMessageIndex: number,
  providerModel: string
): Promise<void>
```

**Summarization** (`summarizeMessages.ts`):
```typescript
export async function summarizeMessages(
  messages: AIMessage[],
  providerModel: string,
  aiSettings: { providers: AIProvider[] },
  user?: NUser,
): Promise<string>
```

### Data Flow

```
User sends message
    ↓
AI responds with tool calls (first response)
    ↓
Check compression conditions
    ↓
[Background] Summarize old messages
    ↓
[Background] Create system message with summary
    ↓
[Background] Save: [summary] + [recent messages]
    ↓
Continue AI generation (foreground)
```

## Benefits

1. **Reduced Token Usage** - Long conversations are compressed into concise summaries
2. **Prevent Context Overflow** - Keeps conversations within model context limits
3. **Maintain Context Quality** - AI retains important information through summaries
4. **Seamless UX** - No disruption to the user's workflow
5. **Cost Efficiency** - Lower token counts reduce API costs

## Example

### Before Compression (10 messages)
```
User: Create a todo app
Assistant: I'll create a todo app
[tool calls: text_editor_write]
Tool: Created index.html
User: Add a dark mode toggle
Assistant: Adding dark mode
[tool calls: text_editor_str_replace]
Tool: Updated styles
User: Make it responsive
Assistant: I'll make it responsive  ← User's last message
[tool calls: text_editor_write]  ← Triggers compression
Tool: Updated CSS
```

### After Compression (4 messages)
```
System: [Summary: Created a todo app with dark mode toggle. User now wants responsive design.]
User: Make it responsive  ← User's last message preserved
Assistant: I'll make it responsive
[tool calls: text_editor_write]
Tool: Updated CSS
```

## Configuration

Currently, compression is automatic with no user configuration required. Future enhancements could include:

- Configurable compression thresholds
- Manual compression triggers
- Compression strategy options (aggressive vs conservative)
- Summary length controls

## Monitoring

Compression activity is logged to the console:
```
Compressing 8 messages for project abc123...
Successfully compressed session context for project abc123. Reduced from 8 to 1 summary message.
```

Errors are logged but don't interrupt the AI generation:
```
Failed to compress session context: [error details]
```

## Best Practices

1. **Let it happen automatically** - The system chooses optimal compression points
2. **Trust the summaries** - The AI model generates high-quality context summaries
3. **Monitor token usage** - Use the context usage indicator to track compression effectiveness
4. **Review compressed history** - After navigation, verify the summary captures key points

## Troubleshooting

**Compression not triggering:**
- Ensure the user message is not the first in the session
- Verify the AI response includes tool calls
- Check console for compression errors

**Summary quality issues:**
- The summary uses the same model as the chat
- Lower quality models may produce less effective summaries
- Consider using higher-quality models for important sessions

**Filesystem errors:**
- Check browser storage quota
- Verify IndexedDB is accessible
- Clear old project data if needed
