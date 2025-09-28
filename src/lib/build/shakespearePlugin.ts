import type { Plugin } from "esbuild-wasm";

/**
 * Shakespeare plugin for dependency polyfills and workarounds.
 * This plugin handles specific dependencies that need custom implementations
 * or dummy APIs to work correctly in the browser environment.
 */
export function shakespearePlugin(): Plugin {
  return {
    name: "shakespeare",

    setup(build) {
      // Handle "sonner" imports with a dummy API
      build.onResolve({ filter: /^sonner$/ }, (args) => {
        return {
          path: args.path,
          namespace: "shakespeare-sonner",
        };
      });

      // Provide dummy sonner implementation
      build.onLoad({ filter: /.*/, namespace: "shakespeare-sonner" }, () => {
        return {
          contents: `
            // Dummy implementation of sonner toast library

            // Toast function that does nothing
            const toast = (message, options) => {
              console.log('[Shakespeare Sonner Mock]:', message, options);
              return { id: Math.random().toString(36) };
            };

            // Add common toast methods
            toast.success = (message, options) => {
              console.log('[Shakespeare Sonner Mock] Success:', message, options);
              return { id: Math.random().toString(36) };
            };

            toast.error = (message, options) => {
              console.log('[Shakespeare Sonner Mock] Error:', message, options);
              return { id: Math.random().toString(36) };
            };

            toast.info = (message, options) => {
              console.log('[Shakespeare Sonner Mock] Info:', message, options);
              return { id: Math.random().toString(36) };
            };

            toast.warning = (message, options) => {
              console.log('[Shakespeare Sonner Mock] Warning:', message, options);
              return { id: Math.random().toString(36) };
            };

            toast.loading = (message, options) => {
              console.log('[Shakespeare Sonner Mock] Loading:', message, options);
              return { id: Math.random().toString(36) };
            };

            toast.promise = (promise, options) => {
              console.log('[Shakespeare Sonner Mock] Promise:', promise, options);
              return promise;
            };

            toast.dismiss = (id) => {
              console.log('[Shakespeare Sonner Mock] Dismiss:', id);
            };

            // Toaster component (dummy React component)
            const Toaster = (props) => {
              console.log('[Shakespeare Sonner Mock] Toaster component rendered:', props);
              return null;
            };

            // Export both named and default exports to match sonner API
            export { toast, Toaster };
            export default toast;
          `,
          loader: "js",
        };
      });

      // Handle "next-themes" imports with a dummy API
      build.onResolve({ filter: /^next-themes$/ }, (args) => {
        return {
          path: args.path,
          namespace: "shakespeare-next-themes",
        };
      });

      // Provide dummy next-themes implementation
      build.onLoad({ filter: /.*/, namespace: "shakespeare-next-themes" }, () => {
        return {
          contents: `
            // Dummy implementation of next-themes

            // useTheme hook that returns system theme
            const useTheme = () => {
              return { theme: "system" };
            };

            // ThemeProvider component (dummy React component)
            const ThemeProvider = ({ children, ...props }) => {
              console.log('[Shakespeare next-themes Mock] ThemeProvider rendered:', props);
              return children;
            };

            // Export both named and default exports to match next-themes API
            export { useTheme, ThemeProvider };
          `,
          loader: "js",
        };
      });

      // Add more dependency polyfills here as needed
      // Example structure for future dependencies:
      // build.onResolve({ filter: /^some-other-package$/ }, (args) => {
      //   return {
      //     path: args.path,
      //     namespace: "shakespeare-other-package",
      //   };
      // });
      //
      // build.onLoad({ filter: /.*/, namespace: "shakespeare-other-package" }, () => {
      //   return {
      //     contents: `// Custom implementation for some-other-package`,
      //     loader: "js",
      //   };
      // });
    },
  };
}