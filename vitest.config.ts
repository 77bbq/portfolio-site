import { getViteConfig } from "astro/config";
import type { ViteUserConfig } from "vitest/config";

const config = {
  test: {
    environment: "node",
  },
} satisfies ViteUserConfig;

export default getViteConfig(config);
