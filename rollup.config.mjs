import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

const name = packageJson.main.replace(/\.js$/, "");

const bundle = (config) => ({
  ...config,
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id),
});

export default [
  {
    input: {
      worker: "src/worker.js",
    },
    output: {
      dir: "./dist",
      format: "cjs",
      sourcemap: true,
    },
    external: ["dayjs", "jsonpath"],
  },
  bundle({
    plugins: [esbuild()],
    output: [
      {
        file: `${name}.js`,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: `${name}.mjs`,
        format: "es",
        sourcemap: true,
      },
    ],
  }),
  bundle({
    plugins: [dts()],
    output: {
      file: `${name}.d.ts`,
      format: "es",
    },
  }),
];
