export function severityTone(severity: string): "neutral" | "amber" | "red" | "blue" {
  if (severity === "CRITICAL") return "red";
  if (severity === "WARNING") return "amber";
  if (severity === "NOTICE") return "blue";
  return "neutral";
}
