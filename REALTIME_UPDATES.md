# Real-Time Updates Implementation

This document describes the implementation of real-time updates for ratings and comments on showcase app pages, eliminating the need for users to refresh the page to see their updates.

## Overview

The implementation uses a combination of:
- **Optimistic Updates**: Immediate UI updates before server confirmation
- **Automatic Cache Invalidation**: Smart query refreshing after publishing events
- **Background Polling**: Periodic data refreshing to catch external changes
- **Error Handling**: Graceful rollback of failed optimistic updates

## Key Components Modified

### 1. `useNostrPublish` Hook (`src/hooks/useNostrPublish.ts`)

**Enhanced with automatic query invalidation:**
- Detects event types (comments, ratings, moderation) based on `kind` and `tags`
- Automatically invalidates relevant TanStack Query caches after successful publishing
- Supports multiple query patterns for comprehensive cache updates

**Invalidation Logic:**
```typescript
// Comments (kind 1111)
if (kind === 1111) {
  queryClient.invalidateQueries({ queryKey: ['nostr', 'comments'] });
}

// Ratings (kind 7)
if (kind === 7) {
  const eTag = tags.find(([name]) => name === 'e')?.[1];
  if (eTag) {
    queryClient.invalidateQueries({ queryKey: ['ratings', eTag] });
  }
}

// App submissions and moderation
if (kind === 31733 || kind === 30267 || kind === 1984) {
  queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
  queryClient.invalidateQueries({ queryKey: ['showcase-moderation'] });
}
```

### 2. Comments System

**`useComments` Hook (`src/hooks/useComments.ts`):**
- Reduced stale time to 10 seconds for fresher data
- Background refetch every 30 seconds
- Maintains existing query structure for compatibility

**`usePostComment` Hook (`src/hooks/usePostComment.ts`):**
- **Optimistic Updates**: Comments appear immediately in UI
- **Error Recovery**: Failed comments are automatically removed from UI
- **Cache Management**: Proper handling of comment threading and structure

**Optimistic Update Flow:**
1. User submits comment
2. Comment appears immediately in UI (optimistic)
3. Event published to Nostr network
4. On success: Cache invalidated, real data fetched
5. On error: Optimistic update reverted, error shown

### 3. Ratings System

**Enhanced Ratings in `ShowcasePage.tsx`:**
- **Immediate Visual Feedback**: Stars update instantly when clicked
- **Optimistic Rating Updates**: New ratings appear before network confirmation
- **Loading States**: Visual indicators during submission
- **Error Handling**: Failed ratings revert with error message

**Optimistic Rating Flow:**
```typescript
const handleRate = (rating: number) => {
  // 1. Update cache optimistically
  queryClient.setQueryData(['ratings', appEvent.id], (oldRatings) => {
    const filteredRatings = oldRatings.filter(r => r.pubkey !== user.pubkey);
    return [...filteredRatings, optimisticRating];
  });

  // 2. Publish to network
  publishEvent({...}, {
    onSuccess: () => toast({ title: 'Rating Submitted!' }),
    onError: () => {
      queryClient.invalidateQueries(['ratings', appEvent.id]); // Revert
      toast({ title: 'Error', variant: 'destructive' });
    }
  });
};
```

### 4. Moderation Actions

**Enhanced in both `AppShowcaseCard.tsx` and `ShowcasePage.tsx`:**
- Immediate cache invalidation after moderation actions
- Multiple query invalidation for comprehensive updates
- Visual feedback during pending actions

**Invalidation Pattern:**
```typescript
// After moderation action
queryClient.invalidateQueries({ queryKey: ['showcase-moderation', id] });
queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
queryClient.invalidateQueries({ queryKey: ['app-submissions'] });
```

### 5. Background Refresh Intervals

**Optimized refresh rates for real-time feel:**
- **Comments**: 10s stale time, 30s background refetch
- **Ratings**: 10s stale time, 30s background refetch  
- **App Submissions**: 10s stale time, 30s background refetch
- **Moderation Data**: 5s stale time, 15s background refetch

## User Experience Improvements

### Immediate Feedback
- **Comments**: Appear instantly when submitted
- **Ratings**: Stars update immediately on click
- **Moderation**: Status changes reflect immediately

### Loading States
- **Comment Form**: Shows "Posting comment..." during submission
- **Rating Stars**: Animate with pulse effect during submission
- **Moderation Menu**: Spinner icon during actions

### Error Handling
- **Failed Comments**: Removed from UI with error toast
- **Failed Ratings**: Reverted with descriptive error message
- **Failed Moderation**: Clear error feedback with retry option

## Technical Benefits

### Performance
- **Reduced Server Load**: Fewer unnecessary requests through smart caching
- **Perceived Speed**: Optimistic updates make UI feel instant
- **Efficient Polling**: Targeted background refreshes only for active data

### Reliability
- **Graceful Degradation**: Falls back to polling if optimistic updates fail
- **Conflict Resolution**: Latest server data always wins over optimistic updates
- **Error Recovery**: Automatic rollback of failed operations

### Maintainability
- **Centralized Logic**: Cache invalidation handled in `useNostrPublish`
- **Type Safety**: Full TypeScript support with proper error handling
- **Consistent Patterns**: Same approach across all real-time features

## Demo Component

**`RealTimeDemo.tsx`** provides a testing interface to demonstrate:
- Optimistic comment updates
- Instant rating feedback
- Real-time moderation changes
- Error handling scenarios

## Implementation Notes

### Query Key Strategy
Consistent query keys enable precise cache invalidation:
- `['nostr', 'comments', eventId]` for comments
- `['ratings', eventId]` for ratings
- `['showcase-moderation', appId]` for moderation status

### Error Boundaries
All optimistic updates include error handling to prevent inconsistent UI state:
- Comments: Remove optimistic comment on error
- Ratings: Invalidate ratings cache on error
- Moderation: Show error toast with retry option

### Network Efficiency
- **Batched Invalidations**: Multiple related queries updated together
- **Smart Polling**: Background refreshes only for visible/active components
- **Timeout Protection**: All network requests have reasonable timeouts

## Future Enhancements

Potential improvements for even better real-time experience:
- **WebSocket Integration**: Real-time event streaming from relays
- **Conflict Resolution**: Better handling of concurrent updates
- **Offline Support**: Queue actions when network is unavailable
- **Push Notifications**: Alert users to new comments/ratings on their apps

## Testing

The implementation includes:
- **Unit Tests**: All hooks have comprehensive test coverage
- **Integration Tests**: Real-time flow testing
- **Error Scenarios**: Failed network requests and edge cases
- **Performance Tests**: Cache invalidation efficiency

Run tests with: `npm run test`