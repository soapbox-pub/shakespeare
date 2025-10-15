# Nostr Git Debugging Guide

## Understanding the Problem

Patches are being published successfully but not showing up in NostrHub or other Nostr git clients. This is likely a **relay synchronization issue**.

## How Nostr Git Discovery Works

1. **Repository Announcement (Kind 30617)**
   - Published once per repository (auto-announced on first patch)
   - Contains metadata: name, description, clone URLs, relays
   - Includes `r` tag with earliest unique commit (euc)
   - Has `d` tag with repository identifier
   - Coordinate: `30617:<pubkey>:<repo-id>`

2. **Patches (Kind 1617)**
   - Reference repository via `a` tag: `30617:<pubkey>:<repo-id>`
   - Include `r` tag with euc for repository-specific filtering
   - Published to relays specified in repository announcement

3. **Discovery Flow**
   - Client queries for repositories (kind 30617)
   - User selects a repository
   - Client queries for patches using `#a` filter: `#a: ["30617:<pubkey>:<repo-id>"]`

4. **Auto-Announcement (Shakespeare Feature)**
   - When creating first patch, repository is auto-announced
   - Uses configured relay from settings
   - Ensures announcement and patch on same relay
   - Eliminates manual "Announce Repository" step

## The Relay Problem

**Key Issue**: Events must be on the **same relay** for discovery to work.

### Scenario:
1. You're connected to `wss://relay.primal.net` in Shakespeare
2. You announce repository → published to `wss://relay.primal.net`
3. You create patch → published to `wss://relay.primal.net`
4. NostrHub is connected to `wss://relay.nostr.band`
5. NostrHub queries `wss://relay.nostr.band` → **finds nothing**

### Why This Happens:
- Nostr relays don't automatically sync with each other
- Each relay is independent
- Events are only on relays they were explicitly published to
- Relay hints in events are suggestions, not guarantees

## Debugging Steps

### Step 1: Check Which Relay You're On

In Shakespeare, check the current relay:
- Look at bottom of the page or settings
- Default is `wss://relay.primal.net`

### Step 2: Verify Repository Announcement

After clicking "Announce Repository", check console logs:

```
=== ANNOUNCING REPOSITORY ===
Repository ID: git.shakespeare.diy/portfoliux
Owner pubkey: 932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d
Event coordinate: 30617:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:git.shakespeare.diy/portfoliux
Published repository announcement to Nostr relays
To verify: Query for kind 30617 with authors=[...] and #d=[...]
```

### Step 3: Verify Patch Can Find Repository

When creating a patch, check console logs:

**If repository exists:**
```
Querying for repository announcement with filter: {...}
Repository announcement query returned 1 events  ✅ GOOD
Found repository announcement event: {...}
```

**If repository doesn't exist (auto-announce):**
```
Repository announcement query returned 0 events
Repository announcement not found - creating one automatically
Auto-creating repository announcement: {...}
Successfully auto-announced repository  ✅ GOOD
```

**If auto-announce fails:**
```
Repository announcement query returned 0 events
Failed to auto-announce repository: <error>  ❌ BAD
```

### Step 4: Check NostrHub's Relay

1. Open NostrHub (nostrhub.io)
2. Check which relay it's using
3. Compare with Shakespeare's relay

## Solutions

### Solution 1: Use Same Relay as NostrHub

1. In Shakespeare settings, change relay to match NostrHub
2. Common NostrHub relays:
   - `wss://relay.nostr.band`
   - `wss://relay.damus.io`
3. Re-announce repository on this relay
4. Create new patch

### Solution 2: Publish to Multiple Relays

When announcing repository, add multiple relays:
- `wss://relay.primal.net`
- `wss://relay.nostr.band`
- `wss://relay.damus.io`

The announcement event will be published to all of these, and patches will follow.

### Solution 3: Use NIP-65 Relay Lists (Future Enhancement)

Proper solution would be to:
1. Query user's NIP-65 relay list
2. Publish repository announcements to all user's read/write relays
3. Patches automatically go to same relays

## Verifying Success

### Check Repository is Discoverable:

1. Open NostrHub
2. Go to Repositories page
3. Look for your repository
4. If found → announcement is on correct relay ✅

### Check Patches are Discoverable:

1. Find your repository on NostrHub
2. Click into repository
3. Check Patches tab
4. Your patches should appear ✅

## Common Issues

### Issue: "Repository announcement not found"
**Cause**: Announcement not on current relay
**Fix**: Re-announce on current relay

### Issue: Patches published but not visible
**Cause**: Patches on different relay than announcement
**Fix**: Ensure both announcement and patches on same relay

### Issue: Works in Shakespeare but not NostrHub
**Cause**: Different relays
**Fix**: Use same relay in both clients

### Issue: Relay hints not working
**Explanation**: Relay hints are suggestions only - clients may ignore them
**Fix**: Ensure announcement is on relay the client uses

## Event Format Reference

### Repository Announcement (Kind 30617)
```json
{
  "kind": 30617,
  "content": "",
  "tags": [
    ["d", "git.shakespeare.diy/portfoliux"],
    ["name", "Portfoliux"],
    ["description", "Portfolio website"],
    ["clone", "nostr://npub.../git.shakespeare.diy/portfoliux"],
    ["relays", "wss://relay.nostr.band"],
    ["r", "abc123...", "euc"]
  ]
}
```

### Patch Event (Kind 1617)
```json
{
  "kind": 1617,
  "content": "From abc... Mon Sep 17...\n<git format-patch content>",
  "tags": [
    ["a", "30617:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:git.shakespeare.diy/portfoliux"],
    ["p", "932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d"],
    ["t", "root"],
    ["t", "root-revision"],
    ["subject", "Fix bug in component"],
    ["r", "abc123..."],
    ["commit", "def456..."],
    ["parent-commit", "ghi789..."]
  ]
}
```

## Testing Relay Synchronization

To test if events are on a relay:

1. **Using nostr.band explorer:**
   - Go to https://nostr.band
   - Search for your event ID or repository coordinate
   - Check which relays have the event

2. **Using console in Shakespeare:**
   ```javascript
   // Check repository announcement
   await nostr.query([{
     kinds: [30617],
     authors: ["your-pubkey"],
     "#d": ["your-repo-id"],
     limit: 1
   }]);

   // Check patches
   await nostr.query([{
     kinds: [1617],
     "#a": ["30617:your-pubkey:your-repo-id"],
     limit: 10
   }]);
   ```

## Recommended Workflow

### Simplified (Auto-Announce Enabled)

1. **Configure relay** (one time):
   - Settings → Select relay (e.g., `wss://relay.nostr.band`)
   - This relay will be used for all Nostr git operations

2. **Create patches** (automatic announcement):
   - Click "Create Patch"
   - System automatically announces repository if needed
   - Patch is published with proper references
   - Check "Your Patches" section to verify

3. **View in NostrHub:**
   - Ensure NostrHub uses same relay
   - Browse to Repositories → Find your repository
   - View patches in Patches tab

### Manual (If Auto-Announce Fails)

1. **First time setup:**
   - Switch to `wss://relay.nostr.band` (widely used)
   - Click "Announce Repository" button
   - Verify announcement succeeded

2. **Creating patches:**
   - Ensure same relay as announcement
   - Create patch
   - Check console for successful repository lookup
   - Verify patch appears in "Your Patches" section

3. **Checking in NostrHub:**
   - Ensure NostrHub on same relay
   - Browse to Repositories
   - Find your repository
   - View patches

## Future Improvements Needed

1. **Multi-relay publishing**: Publish to multiple relays automatically
2. **NIP-65 integration**: Use user's relay list
3. **Relay fallback**: Try multiple relays when querying
4. **Relay selection UI**: Easy relay switching before operations
5. **Event verification**: Confirm events were published successfully
6. **Cross-relay search**: Query multiple relays for better discovery
