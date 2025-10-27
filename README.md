# Shakespeare 🎭

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https://gitlab.com/soapbox-pub/shakespeare.git)

Shakespeare is an open-source AI app builder that runs entirely in your browser.

https://shakespeare.diy

## Features

- **Use any AI provider** OpenAI, Anthropic, OpenRouter, xAI, ZAI, Deepseek, and more
- **Buy credits anonymously** with Nostr and Lightning ⚡
- **Redeem gift cards** with shareable links for instant credits
- **Runs entirely in the browser** No backend required

## How it Works

Shakespeare is a React PWA that stores files in IndexedDB with [LightningFS](https://github.com/isomorphic-git/lightning-fs). Your browser connects directly to AI providers and git services (through [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git)) to enable you to build and deploy AI apps entirely from your device.

Shakespeare hosts no backend (except for a couple microservices in the `services/` directory; these are fully configurable within Shakespeare's settings). All your code and configuration is stored in your browser.

Configure any AI providers and git services you want. Configuration is stored entirely in the browser in localStorage.

You can then push and pull code to syncronize your work across devices.

Shakespeare can work on any type of project. But it is specialized to build React applications in TypeScript, which it compiles in the browser with [esbuild-wasm](https://www.npmjs.com/package/esbuild-wasm) and custom plugins. Any codebase can be worked on, but only compatible projects can be previewed directly in Shakespeare.

## Open Source

Shakespeare is proudly Open Source software licensed under the GNU AGPLv3. The purpose of Shakespeare is to provide a free and open platform for building AI applications that respects user privacy and freedom.

## Mirrors

Shakespeare is available on the following URLs:

- [shakespeare.diy](https://shakespeare.diy)
- [shakespeare.soapbox.dev](https://shakespeare.soapbox.dev)
- [shakespeare-b0b9c8.gitlab.io](https://shakespeare-b0b9c8.gitlab.io)

## Alternatives

- [goose](https://github.com/block/goose) - open-source desktop app and cli utilizing your full computer for AI tasks
- [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) - similar to Shakespeare, but built on closed-source WebContainers technology