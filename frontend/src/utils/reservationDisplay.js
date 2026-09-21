export function formatReservationLabel(reservation) {
  const requesterName = reservation?.requester_name?.trim();
  const purpose = reservation?.purpose?.trim();

  if (requesterName && purpose) return `${requesterName}(${purpose})`;
  return requesterName || purpose || "";
}