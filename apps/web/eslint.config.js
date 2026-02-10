import { nextJsConfig } from "@repo/eslint-config/next-js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config[]} */
export default nextJsConfig;
