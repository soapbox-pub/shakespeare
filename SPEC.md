Please create Shakespeare, an AI chat application that allows users to build custom Nostr websites. On the landing page would be a prompt textarea. Upon entering a prompt, a template would be cloned with `isomorphic-git`. That template's clone URL is hardcoded to `https://relay.ngit.dev/npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p/mkstack.git`. A unique directory name would also be generated from the prompt since the user would be able to work on multiple projects within this app.

For the filesystem, use LightningFS (`@isomorphic-git/lightning-fs` on npm). Note that `isomorphic-git` requires a `Buffer` polyfill to work. isomorphic-git's http client should be added by using `import http from "isomorphic-git/http/web"` (not `fetch`).

After projects have been created, they'll show up in a grid on the homepage, below the prompt textarea, in a grid design similar to Google Drive. Clicking them navigates to the project view. Creating a project through the homepage prompt also redirects to its project view.

In the project view, there is a chat in the left pane, and a project preview in the right. Initially the project preview will be empty, because the site won't have been built yet. The project needs to be built with Vite (directly in the browser) and displayed in an iframe, but we'll figure that out later. Just include a placeholder for it in the UI for now.

In the project chat pane, the user is able to chat with an AI assistant. The assistant will have tools that allow it to work on the project, including editing files and running the Vite build (again, just a stub). In the right preview pane, the user would also be able to switch to a "Code" view, which would display the list of files in the project.

For the AI implementation, use Vercel's ai-sdk (`ai` on npm). It should use the openai provider (`@ai-sdk/openai` on npm) and include a tool set for working on the project.
