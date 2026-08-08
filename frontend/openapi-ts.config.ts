import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? "http://127.0.0.1:3001/doc",
  output: {
    path: "src/client",
    clean: true,
  },
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: "./src/api/hey-api-runtime",
    },
    "@tanstack/react-query",
  ],
});
