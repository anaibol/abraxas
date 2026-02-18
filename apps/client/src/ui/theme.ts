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
    "@keyframes pulse": {
      "0%, 100%": { opacity: "1", transform: "scale(1)" },
      "50%": { opacity: "0.5", transform: "scale(1.2)" },
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);
