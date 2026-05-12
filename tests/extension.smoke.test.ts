import { describe, expect, it, vi } from "vitest";

describe("pi-deep-research extension", () => {
  it("loads without throwing", async () => {
    const { default: factory } = await import("../src/index.js");
    expect(typeof factory).toBe("function");
  });

  it("registers research:hello command", async () => {
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
    };

    factory(mockPi as unknown as Parameters<typeof factory>[0]);

    expect(registeredCommands).toContain("research:hello");
  });

  it("does not register production commands yet (Phase 0)", async () => {
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
    };

    factory(mockPi as unknown as Parameters<typeof factory>[0]);

    const productionCommands = ["research:new", "research:scout", "research:groom"];
    for (const cmd of productionCommands) {
      expect(registeredCommands).not.toContain(cmd);
    }
  });
});
