// Default end = start + 1 hour, clamped to 23:30 of same day
export function computeEndTime(startValue) {
  if (!startValue) return "";
  const startDate = startValue.slice(0, 10);
  const startDt = new Date(startValue);
  const endDt = new Date(startDt.getTime() + 3600000); // Add 1 hour (3600000ms)
  const maxEnd = new Date(`${startDate}T23:30`);
  return (endDt > maxEnd ? maxEnd : endDt).toISOString().slice(0, 16);
}

// Minimum end time = start time + 30 min
export function minEndTime(startValue) {
  if (!startValue) return "00:00";
  const dt = new Date(startValue);
  dt.setMinutes(dt.getMinutes() + 30);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// Convert GMT to EST (UTC-5)
export function convertGMTtoEST(gmtTimeStr) {
  if (!gmtTimeStr) return "";
  // gmtTimeStr: "2026-06-24T08:30"
  const dt = new Date(gmtTimeStr + 'Z'); // Z를 붙여서 UTC로 해석
  
  // EST로 변환 (UTC-5, 5시간 빼기)
  const estDt = new Date(dt.getTime() - 5 * 60 * 60 * 1000);
  
  // "2026-06-24T03:30" 형식으로 반환
  return estDt.toISOString().slice(0, 16);
}

// Add 1 hour to EST time string
export function addOneHourToESTTime(estTimeStr) {
  if (!estTimeStr) return "";
  const dt = new Date(estTimeStr + 'Z');
  const endDt = new Date(dt.getTime() + 3600000); // Add 1 hour
  return endDt.toISOString().slice(0, 16);
}
