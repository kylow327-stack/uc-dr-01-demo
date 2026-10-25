export function formatStamp(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
  }).format(value);
  return `${formatted} UTC`;
}

export function formatConfidence(value: number): string {
  return value.toFixed(2);
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case "ready":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "paused":
      return "Paused";
    case "hitl_waiting":
      return "HITL waiting";
    case "edited":
      return "Edited, waiting";
    case "soft_written":
      return "Soft flag written";
    case "packet_written":
      return "Packet written";
    case "frozen":
      return "Write frozen";
    case "rejected":
      return "Rejected";
    case "escalated":
      return "Escalated";
    case "quarantine":
      return "Quarantine";
    case "killed":
      return "Killed";
    default:
      return phase;
  }
}
