/**
 * Append oracle gate (iv) to a doc instruction.
 * Called by rfc, design-doc, and prd commands after building their primary instruction.
 * ADR intentionally excluded.
 */
export function appendOracleGate(
  primaryInstruction: string,
  oracleInstruction: string
): string {
  return (
    primaryInstruction +
    "\n\n---\n\n## After document is written — run oracle (gate iv)\n\n" +
    oracleInstruction
  );
}
