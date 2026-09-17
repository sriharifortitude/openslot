import axe, { type AxeResults } from 'axe-core';

/**
 * Run axe against a rendered container and return violations in a form
 * that reads well in a failing test. An empty array is the assertion.
 */
export async function violations(container: Element): Promise<string[]> {
  const results: AxeResults = await axe.run(container, {
    // Colour contrast needs a real layout engine; jsdom has none. It is
    // checked separately by hand against the palette in styles.css.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
