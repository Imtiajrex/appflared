import { config } from "@repo/eslint-config/react-internal";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config} */
export default config;
