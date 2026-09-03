export const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  changed: "Changed",
  rejected: "Rejected",
  external: "Staff Calendar",
};

export function statusClass(status) {
  return `status status-${status}`;
}

export const calendarModes = ["day", "week", "month"];
