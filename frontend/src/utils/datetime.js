function pad(num) {
  return String(num).padStart(2, "0");
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function toHourText(value) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  return addDays(d, -day); // Sunday as first day
}

export function endOfWeek(date) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function overlapsPeriod(item, periodStart, periodEnd) {
  const start = new Date(item.start_time);
  const end = new Date(item.end_time);
  return start < periodEnd && end > periodStart;
}

export function sortByStartTime(items) {
  return [...items].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

// Convert local Date object to ISO string preserving local time (not UTC)
// e.g., EDT 13:00 → "2026-06-15T13:00" (not "2026-06-15T17:00")
export function dateToLocalISOString(date) {
  if (!date || !(date instanceof Date)) return "";
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0") +
    "T" +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

// Convert local ISO string (e.g., "2026-06-15T15:00") to UTC ISO string
// EDT 15:00 → "2026-06-15T20:00Z" (EDT is UTC-5)
export function localISOStringToUTCISO(localTimeStr) {
  if (!localTimeStr || typeof localTimeStr !== 'string') return "";
  
  // Parse components
  const [datePart, timePart] = localTimeStr.split('T');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes] = timePart.split(':');
  
  // Create Date object from local time
  const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  
  // Convert to UTC ISO string
  return localDate.toISOString();
}

// Check if a given date is in the past (before today)
export function isPastDate(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return checkDate < today;
}

// Check if a given local time string (e.g., "2026-06-15T15:00") is in the past
export function isPastTime(localTimeStr) {
  if (!localTimeStr || typeof localTimeStr !== 'string') return false;
  
  const [datePart, timePart] = localTimeStr.split('T');
  if (!datePart || !timePart) return false;
  
  const [year, month, day] = datePart.split('-');
  const [hours, minutes] = timePart.split(':');
  
  const checkDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  const now = new Date();
  
  return checkDateTime < now;
}
