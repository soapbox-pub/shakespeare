import type { Plugin } from "esbuild-wasm";

interface ShakespearePluginOptions {
  esmUrl: string;
}

/**
 * Shakespeare plugin for dependency polyfills and workarounds.
 * This plugin handles specific dependencies that need custom implementations
 * or dummy APIs to work correctly in the browser environment.
 */
export function shakespearePlugin(options: ShakespearePluginOptions): Plugin {
  return {
    name: "shakespeare",

    setup(build) {
      // Handle Tailwind CSS configuration files
      build.onResolve({ filter: /^shakespeare:tailwind\.config\.(js|ts)$/ }, (args) => {
        return {
          path: args.path,
          namespace: "shakespeare-tailwind",
        };
      });

      build.onLoad({ filter: /.*/, namespace: "shakespeare-tailwind" }, async (args) => {
        const { pathname } = new URL(args.path);
        return {
          contents: `
            import tailwindConfig from "@/../${pathname}";
            import "${options.esmUrl}/tailwindcss-cdn@3";
            tailwind.config = tailwindConfig;
          `,
          loader: "js",
        };
      });

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

      // Handle "virtual:pwa-register/react" imports with a dummy API
      build.onResolve({ filter: /^virtual:pwa-register\/react$/ }, (args) => {
        return {
          path: args.path,
          namespace: "shakespeare-pwa-register",
        };
      });

      // Provide dummy PWA register implementation
      build.onLoad({ filter: /.*/, namespace: "shakespeare-pwa-register" }, () => {
        return {
          contents: `
            // Dummy implementation of virtual:pwa-register/react

            // useRegisterSW hook that returns dummy functions
            const useRegisterSW = (options = {}) => {
              console.log('[Shakespeare PWA Mock] useRegisterSW called:', options);

              return {
                needRefresh: [false, () => {}],
                offlineReady: [false, () => {}],
                updateServiceWorker: (reloadPage) => {
                  console.log('[Shakespeare PWA Mock] updateServiceWorker called:', reloadPage);
                  if (reloadPage) {
                    window.location.reload();
                  }
                },
              };
            };

            // Export the hook
            export { useRegisterSW };
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