import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "./schema.graphql",
  documents: ["./src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "./src/gql/": {
      preset: "client",
      plugins: [],
      config: {
        useTypeImports: true,
      },
      presetConfig: {
        gqlTagName: "gql",
      },
    },
  },
};

export default config;
