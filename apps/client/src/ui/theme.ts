import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
  globalCss: {
    "html, body, #root": {
      height: "100%",
      width: "100%",
      margin: 0,
      padding: 0,
      overflow: "hidden",
      background: "#08080c",
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);
