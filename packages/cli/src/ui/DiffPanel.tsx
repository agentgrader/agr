import React from "react";
import { Box, Text } from "ink";

export interface DiffPanelProps {
  diff: string;
  title?: string;
  scrollOffset?: number;
  maxVisibleLines?: number;
  emptyLabel?: string;
  width?: number;
}

export function splitDiffLines(diff: string): string[] {
  if (!diff || diff.trim().length === 0) return [];
  return diff.split("\n");
}

export function diffLineColor(line: string): string | undefined {
  if (line.startsWith("@@")) return "cyan";
  if (line.startsWith("+++") || line.startsWith("---")) return "blue";
  if (line.startsWith("+")) return "green";
  if (line.startsWith("-")) return "red";
  return undefined;
}

export const DiffPanel: React.FC<DiffPanelProps> = ({
  diff,
  title,
  scrollOffset = 0,
  maxVisibleLines = 60,
  emptyLabel = "(no diff recorded)",
  width,
}) => {
  const lines = splitDiffLines(diff);
  const paged = lines.slice(scrollOffset, scrollOffset + maxVisibleLines);
  const slots = Array.from({ length: maxVisibleLines }, (_, index) => paged[index] ?? null);
  const lineWidth = width ? Math.max(width - 4, 20) : undefined;
  const hasPaging = lines.length > maxVisibleLines;
  const visibleEnd = Math.min(scrollOffset + maxVisibleLines, lines.length);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} width={width}>
      {title && (
        <Text bold color="cyan">
          {title}
        </Text>
      )}
      {lines.length === 0 ? (
        <Text color="gray">{emptyLabel}</Text>
      ) : (
        slots.map((line, index) => (
          <Box key={`${scrollOffset + index}`} height={1}>
            <Text color={line ? diffLineColor(line) : undefined} wrap="truncate-end">
              {!line
                ? " "
                : lineWidth && line.length > lineWidth
                  ? `${line.slice(0, lineWidth - 1)}…`
                  : line.length > 0
                    ? line
                    : " "}
            </Text>
          </Box>
        ))
      )}
      {hasPaging && (
        <Text color="gray">
          {visibleEnd < lines.length
            ? `Lines ${scrollOffset + 1}-${visibleEnd} of ${lines.length} · ${lines.length - visibleEnd} more below`
            : `Lines ${scrollOffset + 1}-${lines.length} of ${lines.length}`}
        </Text>
      )}
    </Box>
  );
};

export function maxDiffScroll(diff: string, maxVisibleLines: number): number {
  const lines = splitDiffLines(diff);
  return Math.max(0, lines.length - maxVisibleLines);
}
