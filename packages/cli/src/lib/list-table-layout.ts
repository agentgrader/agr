export interface ListColumnLayout {
  width: number;
  marker: number;
  status: number;
  runId: number;
  testCase: number;
  agent: number;
  model: number;
  when: number;
  cost: number;
  steps: number;
}

export function fitCell(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value.padEnd(width);
  if (width === 1) return value.slice(0, 1);
  return `${value.slice(0, width - 1)}…`;
}

export function computeListColumnLayout(terminalWidth: number, showMarker: boolean): ListColumnLayout {
  const width = Math.max(terminalWidth - 2, 72);
  const marker = showMarker ? 2 : 0;
  const status = 6;
  const runId = 10;
  const cost = 9;
  const steps = 12;
  const gapCount = showMarker ? 8 : 7;
  const fixed = marker + status + runId + cost + steps + gapCount;
  const flexible = Math.max(width - fixed, 40);
  const testCase = Math.max(14, Math.round(flexible * 0.34));
  const agent = Math.max(12, Math.round(flexible * 0.24));
  const model = Math.max(12, Math.round(flexible * 0.24));
  const when = Math.max(12, flexible - testCase - agent - model);

  return {
    width,
    marker,
    status,
    runId,
    testCase,
    agent,
    model,
    when,
    cost,
    steps,
  };
}

export function formatListHeader(layout: ListColumnLayout, showMarker: boolean): string {
  const parts: string[] = [];
  if (showMarker) parts.push(fitCell("", layout.marker));
  parts.push(
    fitCell("Status", layout.status),
    fitCell("Run", layout.runId),
    fitCell("Test Case", layout.testCase),
    fitCell("Agent", layout.agent),
    fitCell("Model", layout.model),
    fitCell("When", layout.when),
    fitCell("Cost", layout.cost),
    fitCell("Steps", layout.steps),
  );
  return parts.join(" ");
}

export function formatListRow(
  layout: ListColumnLayout,
  showMarker: boolean,
  cells: {
    marker?: string;
    status: string;
    runId: string;
    testCase: string;
    agent: string;
    model: string;
    when: string;
    cost: string;
    steps: string;
  },
): string {
  const parts: string[] = [];
  if (showMarker) parts.push(fitCell(cells.marker ?? " ", layout.marker));
  parts.push(
    fitCell(cells.status, layout.status),
    fitCell(cells.runId, layout.runId),
    fitCell(cells.testCase, layout.testCase),
    fitCell(cells.agent, layout.agent),
    fitCell(cells.model, layout.model),
    fitCell(cells.when, layout.when),
    fitCell(cells.cost, layout.cost),
    fitCell(cells.steps, layout.steps),
  );
  return parts.join(" ");
}

export function clearTerminalScreen(stdout: NodeJS.WriteStream | undefined): void {
  stdout?.write("\x1b[2J\x1b[H");
}

export function enterAlternateScreen(stdout: NodeJS.WriteStream | undefined): void {
  stdout?.write("\x1b[?1049h");
}

export function leaveAlternateScreen(stdout: NodeJS.WriteStream | undefined): void {
  stdout?.write("\x1b[?1049l");
}
