export const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  changed: "Changed",
  rejected: "Rejected",
};

export function statusClass(status) {
  return `status status-${status}`;
}

export const calendarModes = ["day", "week", "month"];
