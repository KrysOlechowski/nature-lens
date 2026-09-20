import eslint from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceExtensions = "{js,jsx,mjs,cjs,ts,tsx,mts,cts}";

function scopeConfigs(configs, directory) {
  return configs.map((config) => {
    const { files = [`**/*.${sourceExtensions}`], ignores, ...rest } = config;

    return {
      ...rest,
      files: files.map((pattern) => `${directory}/${pattern}`),
      ...(ignores
        ? { ignores: ignores.map((pattern) => `${directory}/${pattern}`) }
        : {}),
    };
  });
}

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "api/dist/**",
      "web/.next/**",
      "web/out/**",
      "web/next-env.d.ts",
    ],
  },
  ...scopeConfigs(nextCoreWebVitals, "web"),
  {
    files: [`web/**/*.${sourceExtensions}`],
    settings: {
      next: {
        rootDir: "web",
      },
    },
  },
  {
    ...eslint.configs.recommended,
    files: [`api/**/*.${sourceExtensions}`],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...scopeConfigs(tseslint.configs.recommended, "api"),
  prettier,
);
