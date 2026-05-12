import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function piDeepResearch(pi: ExtensionAPI) {
  // Phase 0 placeholder — proves the extension loads.
  // Real commands are registered in Phase 1+.
  pi.registerCommand("research:hello", {
    description: "pi-deep-research smoke test",
    handler: async (_args, ctx) => {
      ctx.ui.notify("pi-deep-research alive 🔬", "info");
    },
  });
}
