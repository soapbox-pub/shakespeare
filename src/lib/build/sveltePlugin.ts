import type { Plugin } from "esbuild-wasm";
import type { JSRuntimeFS } from "@/lib/JSRuntime";
import { compile } from "svelte/compiler";

interface SveltePluginOptions {
  fs: JSRuntimeFS;
  projectPath: string;
}

/**
 * Svelte plugin for esbuild to compile .svelte files in the browser.
 * This is a basic implementation that transforms Svelte components to JavaScript.
 */
export function sveltePlugin(options: SveltePluginOptions): Plugin {
  const { fs } = options;

  return {
    name: "svelte",

    setup(build) {
      // Stub SvelteKit $app modules
      build.onResolve({ filter: /^\$app\// }, (args) => {
        return {
          path: args.path,
          namespace: "sveltekit-stub",
        };
      });

      build.onLoad({ filter: /.*/, namespace: "sveltekit-stub" }, (args) => {
        const module = args.path;

        // $app/environment
        if (module === "$app/environment") {
          return {
            contents: `
              export const browser = true;
              export const building = false;
              export const dev = true;
              export const version = "stub";
            `,
            loader: "js",
          };
        }

        // $app/navigation
        if (module === "$app/navigation") {
          return {
            contents: `
              export function afterNavigate(callback) {
                // Stub: no-op in browser build
              }

              export function beforeNavigate(callback) {
                // Stub: no-op in browser build
              }

              export function disableScrollHandling() {
                // Stub: no-op in browser build
              }

              export function goto(url, opts) {
                console.warn('[SvelteKit Stub] goto() called with:', url, opts);
                window.location.href = typeof url === 'string' ? url : url.toString();
                return Promise.resolve();
              }

              export function invalidate(url) {
                console.warn('[SvelteKit Stub] invalidate() called');
                return Promise.resolve();
              }

              export function invalidateAll() {
                console.warn('[SvelteKit Stub] invalidateAll() called');
                return Promise.resolve();
              }

              export function onNavigate(callback) {
                // Stub: no-op in browser build
              }

              export function preloadCode(...args) {
                console.warn('[SvelteKit Stub] preloadCode() called');
                return Promise.resolve();
              }

              export function preloadData(url) {
                console.warn('[SvelteKit Stub] preloadData() called');
                return Promise.resolve();
              }

              export function pushState(url, state) {
                console.warn('[SvelteKit Stub] pushState() called');
                window.history.pushState(state, '', url);
              }

              export function replaceState(url, state) {
                console.warn('[SvelteKit Stub] replaceState() called');
                window.history.replaceState(state, '', url);
              }

              export function refreshAll() {
                console.warn('[SvelteKit Stub] refreshAll() called');
                window.location.reload();
                return Promise.resolve();
              }
            `,
            loader: "js",
          };
        }

        // $app/stores
        if (module === "$app/stores") {
          return {
            contents: `
              import { writable, readable } from 'svelte/store';

              export const page = readable({
                url: new URL(window.location.href),
                params: {},
                route: { id: null },
                status: 200,
                error: null,
                data: {},
                form: null,
                state: {}
              });

              export const navigating = readable(null);

              export const updated = Object.assign(
                readable(false),
                { check: () => Promise.resolve(false) }
              );

              export function getStores() {
                return { page, navigating, updated };
              }
            `,
            loader: "js",
          };
        }

        // $app/paths
        if (module === "$app/paths") {
          return {
            contents: `
              export const base = '';
              export const assets = '';
            `,
            loader: "js",
          };
        }

        // $app/forms (for form actions)
        if (module === "$app/forms") {
          return {
            contents: `
              export function enhance(form, submit) {
                console.warn('[SvelteKit Stub] enhance() called - form actions not supported in browser build');
                return { destroy() {} };
              }

              export function applyAction(result) {
                console.warn('[SvelteKit Stub] applyAction() called');
                return Promise.resolve();
              }

              export function deserialize(result) {
                console.warn('[SvelteKit Stub] deserialize() called');
                return result;
              }
            `,
            loader: "js",
          };
        }

        // Unknown $app module
        return {
          contents: `
            console.error('[SvelteKit Stub] Unknown module: ${module}');
            export default {};
          `,
          loader: "js",
        };
      });

      // Handle .svelte file imports
      build.onLoad({ filter: /\.svelte$/ }, async (args) => {
        try {
          const source = await fs.readFile(args.path, "utf8");

          // Compile the Svelte component
          const result = compile(source, {
            filename: args.path,
            generate: "client", // Svelte 5 uses "client" instead of "dom"
            css: "injected", // Inject CSS into the component
          });

          // Return the compiled JavaScript
          return {
            contents: result.js.code,
            loader: "js",
            warnings: result.warnings?.map((warning) => ({
              text: warning.message,
              location: warning.start ? {
                file: args.path,
                line: warning.start.line,
                column: warning.start.column,
              } : undefined,
            })) || [],
          };
        } catch (error) {
          return {
            errors: [{
              text: error instanceof Error ? error.message : String(error),
              location: { file: args.path },
            }],
          };
        }
      });
    },
  };
}
