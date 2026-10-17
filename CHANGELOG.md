# Changelog

## [9.21.0] - 2026-10-16

### Added
- Talk instead of type — tap the mic in the chat or on the homepage and your words appear as you speak, stopping on their own when you pause; transcription runs entirely on your device, so your voice never leaves it

### Fixed
- Shakespeare can now actually look at images it opens in your project, instead of getting a wall of garbled text
- Images, PDFs, and other files Shakespeare downloads from the web no longer come out corrupted

## [9.20.2] - 2026-10-16

### Changed
- When your signer doesn't respond while publishing a site to Nostr, Shakespeare now explains why and what to do, instead of showing a cryptic "signal has been aborted" error

## [9.20.1] - 2026-10-16

### Fixed
- Publishing a big site to Nostr while signed in with a remote signer no longer fails with an "invalid plaintext size" error
- Closed a security hole where a crafted link could send you to an outside website

## [9.20.0] - 2026-10-15

### Added
- Shakespeare can now open your app and use it like a person would — clicking buttons, filling in forms, and reading what's on screen — so it can check its own work and catch problems before you do

### Fixed
- Shakespeare can see WebP, GIF, and other image types you attach, not just JPEG and PNG
- Images in messages you queue up while Shakespeare is working are no longer lost, and Shakespeare no longer claims it never saw an image from earlier in the chat

## [9.19.0] - 2026-10-15

### Added
- Keep the ideas flowing while Shakespeare works — send messages mid-task and they'll wait in a queue, then go out as soon as it finishes; you can remove any before they're sent, and they survive a reload
- Copy any message in the chat with one click, including Shakespeare's replies and your queued messages

### Changed
- Your unsent message stays put for each project, so a reload, switching projects, or flipping between chat and preview on your phone no longer wipes what you were typing

## [9.18.1] - 2026-10-15

### Changed
- Apps you build can remember permission to read their own encrypted data, like saved settings or lists, so you aren't asked every time — reading your private messages is still a separate choice

### Fixed
- The close button in the image viewer no longer hides under your phone's status bar, and you can now swipe an image up or down to dismiss it

## [9.18.0] - 2026-10-15

### Added
- Nostr apps you build can now sign in with your account right in the preview — Shakespeare asks before each request, can remember your choice per project, and always checks with you before reading your private messages
- Deploys keep going in the background, so you can close the deploy menu or switch projects while your site publishes, and a notification lets you know when it's live
- Watch your nsite and npanel deploys happen with a progress bar and each step named as it goes, and cancel partway through if you change your mind

### Changed
- Publishing to nsite and npanel is much faster — your site goes live as soon as every file has landed somewhere, and redeploys only upload and sign for what actually changed
- The deploy menu is simpler, with less-used options tucked away under Advanced

## [9.17.1] - 2026-10-14

### Fixed
- Everything new in 9.17.0 — Python, type checking, and the reasoning effort setting — now actually reaches shakespeare.diy, after that release got stuck before it could go live

## [9.17.0] - 2026-10-14

### Added
- Shakespeare can now run Python right in your browser — it can write and run scripts to crunch data, generate files, or try out an idea, and install packages with pip
- Shakespeare now checks its own code for type errors as it works, catching mistakes before you ever see them, and gets this check ready in the background as soon as you open a project
- Choose how hard the AI thinks before it answers in Settings > AI > Advanced — it starts on low for quick, affordable replies, and you can turn it up for tougher tasks

### Changed
- Shakespeare's built-in terminal now speaks real bash, so the commands the AI runs behave the way they would on your own computer instead of failing in surprising ways

### Fixed
- Claude models on OpenRouter keep their train of thought between steps instead of losing it after every action
- New projects get a proper name again with newer Claude models instead of being called "untitled"
- Files written with multi-line commands are no longer left empty or garbled
- Commit summaries list the files you added and changed again
- Long conversations with Claude stay fast and affordable thanks to more reliable caching

## [9.16.6] - 2026-10-14

### Fixed
- Sites with long names now load on every nsite gateway — names are kept short enough for a web address, with a short code added when needed so two similar names never overwrite each other

## [9.16.5] - 2026-09-20

### Fixed
- Publishing a site no longer drops its largest files on a slow connection — big uploads are given the time they need to finish instead of being cut off on a fixed deadline
- When an upload does fail, the error names each file, its size, and what the server actually said, so you can tell a file that's too large from one that timed out

## [9.16.4] - 2026-09-16

### Changed
- Published sites carry only the tags the nsite spec defines — the relay hints Shakespeare used to attach were read by nothing, and taking a site back no longer rewrites them

## [9.16.3] - 2026-09-14

### Added
- Take back your sites one at a time — every name waiting for you now has its own Publish, Show, and Delete buttons, so you can keep the few you want and clear out the rest
- Show opens a site by its Nostr address before you decide about it, so you can look at names that never loaded in a browser

### Changed
- Deleting a name only gives it up on shakespeare.wtf — anything published to Nostr stays yours
- Names that couldn't be taken back safely can now be cleared out, instead of only explaining why they were stuck

## [9.16.2] - 2026-09-13

### Changed
- Deploy settings now says how many of your names are waiting to be taken back, and stays quiet when there are none

### Fixed
- Names you published before shakespeare.wtf changed hands are recognized as yours as you type them — the Deploy screen offers to hand them back instead of reporting them taken by somebody else

## [9.16.1] - 2026-09-13

### Fixed
- Deploying to a name you already own works again — names you took back in the migration were reported as taken by somebody else, and the Deploy button refused to publish to your own site

## [9.16.0] - 2026-09-13

### Added
- Take back the sites you published before shakespeare.wtf changed hands — Deploy settings now lists every name that's waiting for you and hands them all back at once, republished under your own key
- Deploys report which relays accepted your site, and can fill in any that missed it without republishing

### Changed
- Deploying to Shakespeare now publishes your site to Nostr under your own key, so it stays readable by any Nostr site viewer with or without shakespeare.wtf
- Recovered sites are titled whatever they call themselves rather than after their web address

### Fixed
- Deploying to Shakespeare works again — it had been reporting success while changing nothing, because the host it uploaded to no longer serves those addresses
- New accounts start with Shakespeare set up as a deployment target instead of an empty screen
- Deployment provider settings now scroll, so Save is always reachable

## [9.15.0] - 2026-08-19

### Added
- Connect to Meridian as an AI provider — available as a one-click preset with streamlined setup
- Optimize Repository action in the project menu that consolidates git history to reclaim space and repair bloated repositories

### Fixed
- Zaps now verify the invoice amount before paying, so you're never charged more than you approved

## [9.14.0] - 2026-06-05

### Added
- Log in with a remote signer by scanning a QR code — connect your NIP-46 mobile signer to Shakespeare without copying and pasting bunker strings

### Changed
- Unified the login dialog into a single, streamlined experience across sign-in methods

### Fixed
- Custom fonts now load correctly in previews instead of triggering a runtime error
- Builds no longer fail when a project depends on types-only packages
- Resolved all known security vulnerabilities in dependencies

## [9.13.2] - 2026-04-29

### Changed
- Preview pane now uses the new iframe.diy sandboxing service for a faster, more reliable preview experience

## [9.13.1] - 2026-04-27

### Changed
- AI agents now run commands through a real POSIX-style shell with proper quoting, pipes, redirects, and glob expansion, making multi-step project edits more reliable
- Overhauled the built-in `git` commands used by AI agents, adding `ls-files`, `merge`, `mv`, `restore`, `rev-parse`, `revert`, `rm`, and `switch` alongside improvements across existing git operations
- Overhauled core shell commands (`cat`, `cp`, `find`, `grep`, `ls`, `sed`, `sort`, and more) for closer POSIX behavior and better ergonomics when AI agents work on your project

## [9.13.0] - 2026-04-26

### Added
- Build projects with Tailwind CSS v4, including `@import "tailwindcss"` entry files and third-party v4 plugins like `tw-animate-css`

## [9.12.0] - 2026-04-25

### Added
- Build support for module workers and static asset URLs — projects using `new Worker(new URL('./w.ts', import.meta.url), { type: 'module' })`, `SharedWorker`, and `new URL('./logo.svg', import.meta.url)` now build and run correctly in the preview
- Preview pane grants microphone, ambient-light-sensor, and other device permissions so richer apps can run inside the preview

## [9.11.4] - 2026-04-17

### Fixed
- Preview pane no longer gets stuck on stale builds during rapid edits

### Changed
- Reduce AI costs for Anthropic models via OpenRouter by caching tool definitions across turns

## [9.11.3] - 2026-04-12

### Fixed
- App publish dialog now appears on mobile devices
- Changelog available offline via ServiceWorker precache

## [9.11.2] - 2026-04-06

### Fixed
- Derive private preview subdomains with HMAC to prevent cross-project origin collisions on iframe.diy

## [9.11.1] - 2026-04-05

### Changed
- Switch preview pane to iframe.diy for improved reliability and compatibility
- New users start with OpenCode Zen pre-configured for a zero-setup first experience
- Default nsite gateway changed to shakespeare.to with vanity subdomain support
- Update default Blossom servers and relay lists across deployments and uploads

### Fixed
- Default settings no longer override existing users' recently used models
- Showcase card clone URLs now use proper Nostr URI encoding
- Service worker no longer blocks SvelteKit nsite routes

## [9.11.0] - 2026-04-03

### Added
- Upload a banner image for your app directly from the App dialog
- T-tag editor in the App dialog Advanced section for tagging your app by category
- Delete App button in the App dialog Advanced section when editing an existing app
- Ngit repo and nsite deployment address fields in the App dialog Advanced section
- Auto-fill app name, description, and images from your project's OG tags and web manifest on first publish

### Changed
- Redesigned App dialog with an overlapping banner and avatar card layout
- Reorganized App dialog Advanced section into General, Handlers, and Tags tabs
- Showcase cards now show banner and icon images, and require both to appear in the showcase
- Validation summary above the Save button replaces per-field "Required" labels
- Updated showcase curator to the Shakespeare Builders community list

### Fixed
- Upgrade Nostrify to fix bunker connection issues

## [9.10.4] - 2026-04-02

### Fixed
- Fix Android splash screen showing logo masked to white silhouette instead of full color

## [9.10.3] - 2026-04-02

### Fixed
- Fix Android app showing default Capacitor splash screen and icon colors

## [9.10.2] - 2026-04-02

### Fixed
- Fix Android app showing default Capacitor icon instead of Shakespeare logo in app drawer

## [9.10.1] - 2026-04-02

### Fixed
- Replace default Capacitor vector drawable icons with Shakespeare logo

## [9.10.0] - 2026-04-02

### Added
- Android app powered by Capacitor with deep links, splash screen, and signed release builds
- CI pipeline for building APKs, publishing to GitLab releases, and distributing via Zapstore
- Nsite deployment for decentralized hosting via Nostr

### Changed
- Make version number on mobile settings a clickable link to the changelog with build date

## [9.9.2] - 2026-04-02

### Changed
- Simplify nsite deployment to always use named sites, removing the root site option

### Fixed
- Fix crash in "What's new" toast when used outside the router context
- Truncate long changelog excerpts in update notifications so they fit neatly in the toast
- Left-align changelog page content for better readability

## [9.9.1] - 2026-04-02

### Added
- Changelog page and versioning system with "What's new" toast notifications on updates
- Release skill for managing versioned releases with changelog generation and git tagging
