import { describe, expect, it, vi } from "vitest";

const ALL_COMMANDS = [
  "research:new",
  "research:scout",
  "research:groom",
  "research:alternatives",
  "research:document",
  "research:adr",
  "research:rfc",
  "research:design-doc",
  "research:prd",
  "research:oracle",
  "research:contract",
  "research:evaluate",
  "research:doctor",
  "research:status",
  "research:resume",
];

describe("pi-deep-research extension", () => {
  it("loads without throwing", async () => {
    const { default: factory } = await import("../src/index.js");
    expect(typeof factory).toBe("function");
  });

  it("registers all 15 /research:* commands", async () => {
    const { default: factory } = await import("../src/index.js");

    const registeredCommands: string[] = [];
    const mockPi = {
      registerCommand: vi.fn((name: string) => {
        registeredCommands.push(name);
      }),
      on: vi.fn(),
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      sendMessage: vi.fn(),
      sendUserMessage: vi.fn(),
    };

    factory(mockPi as unknown as Parameters<typeof factory>[0]);

    for (const cmd of ALL_COMMANDS) {
      expect(registeredCommands, `missing command: ${cmd}`).toContain(cmd);
    }
    expect(registeredCommands).toHaveLength(ALL_COMMANDS.length);
  });

  it("does not register any non-research commands", async () => {
    const { default: factory } = await import("../src/index.js");

    const registeredCommands: string[] = [];
    const mockPi = {
      registerCommand: vi.fn((name: string) => { registeredCommands.push(name); }),
      on: vi.fn(),
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      sendMessage: vi.fn(),
      sendUserMessage: vi.fn(),
    };

    factory(mockPi as unknown as Parameters<typeof factory>[0]);

    for (const cmd of registeredCommands) {
      expect(cmd, `unexpected non-research command: ${cmd}`).toMatch(/^research:/);
    }
  });
});
