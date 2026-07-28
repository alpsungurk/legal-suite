// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig as lovableDefineConfig } from "@lovable.dev/vite-tanstack-config";
import type { ConfigEnv, PluginOption, UserConfig } from "vite";

const TSCONFIG_PATHS_PLUGINS = new Set([
  "vite-tsconfig-paths",
  "vite-plugin-tsconfig-paths",
]);

function withoutTsconfigPathsPlugin(
  plugins: PluginOption[] | undefined,
): PluginOption[] | undefined {
  if (!plugins) return plugins;

  return plugins.flatMap((plugin) => {
    if (!plugin) return [];
    if (Array.isArray(plugin)) return withoutTsconfigPathsPlugin(plugin) ?? [];
    if (typeof plugin === "object" && "name" in plugin) {
      return TSCONFIG_PATHS_PLUGINS.has(plugin.name) ? [] : [plugin];
    }
    return [plugin];
  });
}

const lovableConfig = lovableDefineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      tsconfigPaths: true,
    },
  },
});

export default async (env: ConfigEnv): Promise<UserConfig> => {
  const config = await lovableConfig(env);
  return {
    ...config,
    plugins: withoutTsconfigPathsPlugin(config.plugins as PluginOption[]),
  };
};
