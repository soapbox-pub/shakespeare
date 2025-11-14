# Emoji Reactions for Comments

This document describes the implementation of emoji reactions for comments on showcase app pages, allowing users to express their feelings about comments using emoji reactions like 👍, ❤️, 😂, etc.

## Overview

The emoji reactions system provides:
- **Quick Engagement**: React to comments without writing full replies
- **Visual Feedback**: See popular reactions and participation levels
- **Real-time Updates**: Reactions appear instantly with optimistic updates
- **Social Context**: Tooltips show who reacted with each emoji
- **Toggle Functionality**: Click reactions to add/remove your reaction

## Implementation Architecture

### 1. Core Hook: `useCommentReactions`

**File**: `src/hooks/useCommentReactions.ts`

**Features:**
- Fetches kind 7 reactions for specific comments
- Groups reactions by emoji with user tracking
- Handles reaction addition/removal with optimistic updates
- Supports real-time synchronization

**Key Functions:**
```typescript
// Fetch reactions for a comment
useCommentReactions(commentId: string)

// Add/toggle reactions
useAddCommentReaction()
```

**Reaction Data Structure:**
```typescript
interface CommentReaction {
  emoji: string;           // The emoji (e.g., "👍")
  count: number;           // Number of users who reacted
  userReacted: boolean;    // Whether current user reacted
  users: string[];         // Pubkeys of users who reacted
}
```

### 2. UI Component: `EmojiReactions`

**File**: `src/components/comments/EmojiReactions.tsx`

**Features:**
- Displays existing reactions as clickable badges
- Provides emoji picker for adding new reactions
- Shows tooltips with reaction context
- Handles loading states and user authentication

**Component Structure:**
```typescript
<EmojiReactions 
  commentId={comment.id}
  commentAuthor={comment.pubkey}
  className="pt-2"
/>
```

### 3. Integration with Comments

**File**: `src/components/comments/Comment.tsx`

The emoji reactions are seamlessly integrated into the existing comment component, appearing between the comment content and action buttons.

## Predefined Emoji Set

The system includes 8 carefully chosen emoji reactions:

| Emoji | Label | Use Case |
|-------|-------|----------|
| 👍 | thumbs up | General approval/agreement |
| ❤️ | heart | Love/strong positive feeling |
| 😂 | laugh | Funny/humorous content |
| 😮 | wow | Surprise/amazement |
| 😢 | sad | Sadness/empathy |
| 😡 | angry | Disagreement/frustration |
| 🎉 | celebrate | Celebration/excitement |
| 🔥 | fire | Impressive/awesome content |

## Nostr Protocol Integration

### Event Structure

Emoji reactions use **kind 7 events** (reactions) with specific formatting:

**Adding a Reaction:**
```json
{
  "kind": 7,
  "content": "👍",
  "tags": [
    ["e", "comment-event-id"],
    ["p", "comment-author-pubkey"]
  ]
}
```

**Removing a Reaction:**
```json
{
  "kind": 7,
  "content": "-👍",
  "tags": [
    ["e", "comment-event-id"],
    ["p", "comment-author-pubkey"]
  ]
}
```

### Reaction Processing Logic

1. **Fetch**: Query kind 7 events referencing the comment
2. **Group**: Organize by emoji and user (latest reaction wins)
3. **Filter**: Remove reactions with "-" prefix (removals)
4. **Aggregate**: Count active reactions per emoji
5. **Display**: Show sorted by popularity

## User Experience Features

### Optimistic Updates

**Immediate Feedback:**
- Reactions appear instantly when clicked
- UI updates before network confirmation
- Smooth animations and visual feedback

**Error Recovery:**
- Failed reactions automatically revert
- Clear error messages for network issues
- Graceful degradation when offline

### Visual Design

**Reaction Badges:**
- Highlighted when user has reacted
- Shows emoji + count in compact format
- Hover effects for better interactivity

**Emoji Picker:**
- Grid layout with all available emojis
- Accessible with keyboard navigation
- Auto-closes after selection

### Accessibility

**Keyboard Support:**
- Tab navigation through reactions
- Enter/Space to toggle reactions
- Escape to close emoji picker

**Screen Reader Support:**
- Descriptive labels for all buttons
- Reaction counts announced properly
- Tooltip content accessible

## Real-time Synchronization

### Cache Management

**Automatic Invalidation:**
```typescript
// In useNostrPublish hook
if (kind === 7) {
  const eTag = tags.find(([name]) => name === 'e')?.[1];
  if (eTag) {
    queryClient.invalidateQueries({ queryKey: ['comment-reactions', eTag] });
  }
}
```

**Background Refresh:**
- 10 second stale time for fresh data
- 30 second background refetch interval
- Catches external reactions from other users

### Optimistic Update Flow

1. **User clicks reaction** → UI updates immediately
2. **Event published** to Nostr network
3. **On success** → Cache invalidated for real data
4. **On error** → Optimistic update reverted

## Performance Optimizations

### Efficient Queries

**Targeted Fetching:**
- Only fetch reactions for visible comments
- Limit to 500 reactions per comment (reasonable max)
- 3-second timeout for network requests

**Smart Caching:**
- Per-comment reaction caching
- Automatic cleanup of unused data
- Optimized re-renders with React.memo

### Network Efficiency

**Batch Operations:**
- Single query for all comment reactions
- Efficient event filtering and processing
- Minimal redundant network requests

## Integration Examples

### Basic Usage

```tsx
import { EmojiReactions } from '@/components/comments/EmojiReactions';

function CommentCard({ comment }) {
  return (
    <div>
      <p>{comment.content}</p>
      <EmojiReactions 
        commentId={comment.id}
        commentAuthor={comment.pubkey}
      />
    </div>
  );
}
```

### Custom Styling

```tsx
<EmojiReactions 
  commentId={comment.id}
  commentAuthor={comment.pubkey}
  className="mt-3 border-t pt-3"
/>
```

## Demo Component

**File**: `src/components/EmojiReactionsDemo.tsx`

Provides interactive demonstration of:
- Reaction toggling functionality
- Emoji picker interface
- Real-time update behavior
- Available emoji set

## Testing Strategy

### Unit Tests

**Hook Testing:**
- Reaction fetching and processing
- Optimistic update logic
- Error handling scenarios

**Component Testing:**
- Emoji picker functionality
- Reaction badge interactions
- Loading and error states

### Integration Tests

**Real-time Flow:**
- End-to-end reaction posting
- Cache invalidation verification
- Cross-user reaction visibility

## Future Enhancements

### Potential Improvements

**Custom Emojis:**
- Support for custom emoji reactions
- Unicode emoji search functionality
- Reaction categories and organization

**Enhanced Analytics:**
- Reaction trend analysis
- Popular emoji tracking
- User engagement metrics

**Advanced Features:**
- Reaction notifications
- Bulk reaction operations
- Reaction history viewing

### Scalability Considerations

**Large Comment Threads:**
- Pagination for reactions
- Virtual scrolling for performance
- Lazy loading of reaction data

**High-Traffic Scenarios:**
- Rate limiting for reactions
- Debounced optimistic updates
- Efficient WebSocket integration

## Security Considerations

### Spam Prevention

**Rate Limiting:**
- Client-side debouncing
- Reasonable reaction frequency limits
- User authentication requirements

**Content Validation:**
- Emoji format validation
- Maximum reaction count per user
- Malicious content filtering

### Privacy

**User Data:**
- Reaction anonymity options
- Configurable visibility settings
- GDPR compliance considerations

## Troubleshooting

### Common Issues

**Reactions Not Appearing:**
- Check user authentication status
- Verify network connectivity
- Confirm relay accessibility

**Performance Problems:**
- Monitor query cache size
- Check for memory leaks
- Optimize re-render frequency

**Synchronization Issues:**
- Validate event publishing
- Check cache invalidation logic
- Verify real-time polling intervals

### Debug Tools

**Development Helpers:**
- React Query DevTools integration
- Console logging for cache operations
- Network request monitoring

This emoji reactions system enhances user engagement while maintaining excellent performance and real-time synchronization across the Nostr network.