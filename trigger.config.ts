import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: "proj_qlchtgpeaiwacyauoqdo",
  dirs: ["./jobs"],
  maxDuration: 300,
  build: {
    // "react-server" condition makes server-only resolve to its empty stub
    // instead of its default index.js which throws in plain Node.js.
    conditions: ["react-server"],
  },
})
