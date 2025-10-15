# Nostr Git Integration

Shakespeare supports creating patches for Nostr git repositories following [NIP-34 (git stuff)](https://github.com/nostr-protocol/nips/blob/master/34.md).

## Overview

Nostr git is a decentralized approach to code collaboration using Nostr events instead of centralized git hosting platforms. With Nostr git:

- **Repository announcements** (kind 30617) declare the existence of git repositories
- **Patches** (kind 1617) are submitted as Nostr events, similar to pull requests
- **Anyone can submit patches** without needing push access or creating forks
- **Maintainers review and apply patches** through status events

## How It Works in Shakespeare

### 1. Repository URL Format

Nostr git repositories use a special URL format:

```
nostr://<pubkey>/<repo-id>
```

- `<pubkey>`: The repository maintainer's Nostr public key (hex format)
- `<repo-id>`: The repository identifier (d tag, usually kebab-case)

Example: `nostr://abc123.../my-project`

### 2. Creating Patches (Pull Requests)

When you create a "Pull Request" for a Nostr git repository, Shakespeare:

1. **Detects Nostr git URL** - Recognizes the `nostr://` prefix
2. **Creates patch event** - Generates a kind 1617 event with:
   - Patch content (git diff or description)
   - Reference to repository announcement (`a` tag)
   - Tags for repository owner, patch title, description
   - NIP-31 `alt` tag for human-readable description
3. **Publishes to Nostr** - Sends the patch to the repository's designated relays
4. **No forking required** - Unlike GitHub/GitLab, patches go directly to the upstream repo

### 3. UI Integration

The existing Pull Request dialog automatically adapts for Nostr git:

- **Button text**: "Create Patch" instead of "Create Pull Request"
- **No credentials needed**: Uses your Nostr signer (logged-in account)
- **No fork workflow**: Patches are submitted directly
- **Success message**: Shows the Nostr event ID as confirmation

### 4. Key Differences from GitHub/GitLab

| Feature | GitHub/GitLab | Nostr Git |
|---------|---------------|-----------|
| Authentication | Personal access token | Nostr signer |
| Fork required | Yes (if no push access) | No |
| Push to remote | Yes | No (patch is in event) |
| PR/Patch format | API-based | Nostr event (kind 1617) |
| Relay/server | Centralized | Decentralized relays |

## Implementation Details

### GitHostProvider Interface

Nostr git is implemented as a `NostrGitProvider` that implements the `GitHostProvider` interface:

```typescript
class NostrGitProvider implements GitHostProvider {
  // Query repository announcements (kind 30617)
  async getRepository(owner: string, repo: string): Promise<GitRepository>
  
  // Check if user is a maintainer
  async canUserPush(owner: string, repo: string): Promise<boolean>
  
  // Create patch event (kind 1617)
  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequest>
  
  // ... other methods
}
```

### Patch Event Structure

Patches follow NIP-34 specifications:

```json
{
  "kind": 1617,
  "content": "<patch content>",
  "tags": [
    ["a", "30617:<repo-owner-pubkey>:<repo-id>"],
    ["p", "<repository-owner>"],
    ["t", "root"],
    ["t", "root-revision"],
    ["subject", "<patch-title>"],
    ["description", "<patch-description>"],
    ["alt", "Patch proposal for <repo>: <title>"]
  ]
}
```

### Repository Detection

The system detects Nostr git URLs in multiple places:

1. **URL parsing** - `detectGitHost()` checks for `nostr://` prefix
2. **Remote info** - Extracts owner (pubkey) and repo (d tag) from URL
3. **Provider creation** - Instantiates `NostrGitProvider` with signer

## Future Enhancements

Potential improvements to Nostr git integration:

- [ ] Generate actual git patches using `git format-patch`
- [ ] Support patch series (multiple commits)
- [ ] Display patch status (open/closed/applied)
- [ ] Show existing patches for a repository
- [ ] Support patch reviews and comments (kind 1621)
- [ ] Apply patches locally for testing
- [ ] Maintainer tools for applying/merging patches

## Related NIPs

- **NIP-34**: git stuff (repository announcements, patches, issues)
- **NIP-31**: alt tag for unknown event kinds
- **NIP-22**: Comments (for patch discussions)

## Example Workflow

1. **Clone Nostr git repo**:
   ```bash
   # Repository URL: nostr://abc123.../my-project
   git clone https://actual-clone-url.git
   ```

2. **Make changes and commit**:
   ```bash
   git checkout -b my-feature
   # ... make changes ...
   git commit -m "Add new feature"
   ```

3. **Create patch in Shakespeare**:
   - Open Pull Request dialog
   - System detects Nostr git URL
   - Fill in title and description
   - Click "Create Patch"
   - Patch is published to Nostr relays

4. **Maintainer receives patch**:
   - Sees patch event on their relays
   - Reviews the proposed changes
   - Applies or rejects via status events

## Resources

- [NIP-34 Specification](https://github.com/nostr-protocol/nips/blob/master/34.md)
- [Nostr Protocol](https://nostr.com)
- [Git Format-Patch](https://git-scm.com/docs/git-format-patch)
