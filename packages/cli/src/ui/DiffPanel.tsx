import React from "react";
import { Box, Text } from "ink";

export interface DiffPanelProps {
  diff: string;
  title?: string;
  scrollOffset?: number;
  maxVisibleLines?: number;
  emptyLabel?: string;
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
}) => {
  const lines = splitDiffLines(diff);
  const truncated = lines.length > maxVisibleLines;
  const window = lines.slice(scrollOffset, scrollOffset + maxVisibleLines);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} flexGrow={1}>
      {title && (
        <Text bold color="cyan">
          {title}
        </Text>
      )}
      {lines.length === 0 ? (
        <Text color="gray">{emptyLabel}</Text>
      ) : (
        window.map((line, i) => (
          <Text key={`${scrollOffset + i}-${line}`} color={diffLineColor(line)}>
            {line.length > 0 ? line : " "}
          </Text>
        ))
      )}
      {truncated && scrollOffset + maxVisibleLines < lines.length && (
        <Text color="gray">... {lines.length - scrollOffset - maxVisibleLines} more line(s)</Text>
      )}
    </Box>
  );
};

export function maxDiffScroll(diff: string, maxVisibleLines: number): number {
  const lines = splitDiffLines(diff);
  return Math.max(0, lines.length - maxVisibleLines);
}
