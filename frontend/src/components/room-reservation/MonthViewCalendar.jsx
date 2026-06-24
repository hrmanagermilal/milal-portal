import { useState } from "react";
import Box from "@mui/material/Box";
import FloorPlanTooltip from "./FloorPlanTooltip";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { statusLabel } from "../../constants";
import {
  addDays,
  endOfDay,
  endOfMonth,
  formatDateTime,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "../../utils/datetime";
import NewReservationModal from "./NewReservationModal";
import { useLanguage } from "../../i18n/LanguageContext";

function sortByStartTime(items) {
  return items.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function overlapsPeriod(item, periodStart, periodEnd) {
  const itemStart = new Date(item.start_time);
  const itemEnd = new Date(item.end_time);
  return !(itemEnd <= periodStart || itemStart >= periodEnd);
}

function statusClass(status) {
  const statusColorMap = {
    pending: "status-pending",
    approved: "status-approved",
    changed: "status-changed",
    rejected: "status-rejected",
  };
  return statusColorMap[status] || "status-default";
}

export default function MonthViewCalendar({ date, rooms, reservations, onNavigate, onSubmitReservation }) {
  const { t } = useLanguage();
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, idx) => addDays(gridStart, idx));

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [form, setForm] = useState({
    room_id: "",
    requester_name: "",
    phone: "",
    email: "",
    start_time: "",
    end_time: "",
    purpose: "",
    attendees: "1",
    notes: "",
  });

  const handleCellClick = (clickedDate) => {
    setSelectedDate(clickedDate);
    
    // Set default room (first room if available)
    const defaultRoomId = rooms.length > 0 ? rooms[0].id : null;
    setSelectedRoomId(defaultRoomId);
    
    const startDateTime = new Date(clickedDate);
    startDateTime.setHours(9, 0, 0, 0); // Default to 9 AM
    const endDateTime = new Date(startDateTime.getTime() + 3600000); // 1 hour duration
    
    setForm((prev) => ({
      ...prev,
      room_id: defaultRoomId ? String(defaultRoomId) : "",
      start_time: startDateTime.toISOString().slice(0, 16),
      end_time: endDateTime.toISOString().slice(0, 16),
    }));
    
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedRoomId(null);
    setForm({
      room_id: "",
      requester_name: "",
      phone: "",
      email: "",
      start_time: "",
      end_time: "",
      purpose: "",
      attendees: "1",
      notes: "",
    });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (onSubmitReservation) {
      onSubmitReservation(form);
    }
    handleModalClose();
  };

  return (
    <Box>
      {/* Navigation */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
        {/* Left: month/year label */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: { xs: "14px", md: "16px" }, color: "#313b5e", order: { xs: 2, md: 1 }, width: { xs: "100%", md: "auto" }, textAlign: { xs: "center", md: "left" } }}>
          {date.toLocaleDateString([], { year: "numeric", month: "long" })}
        </Typography>

        {/* Right: Prev/Today/Next + date picker */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ order: { xs: 1, md: 2 }, ml: { xs: 0, md: "auto" } }}>
          <ButtonGroup size="small" variant="outlined">
            <Button onClick={() => onNavigate(-1)}
              sx={{ color: "#1976d2", borderColor: "#d8dfe7", fontWeight: 600, fontSize: "13px", transition: "all 0.2s ease", "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)", borderColor: "#1976d2" } }}
            >{t("prev")}</Button>
            <Button onClick={() => onNavigate(0)}
              sx={{ color: "#1976d2", borderColor: "#d8dfe7", fontWeight: 600, fontSize: "13px", transition: "all 0.2s ease", "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)", borderColor: "#1976d2" } }}
            >{t("today")}</Button>
            <Button onClick={() => onNavigate(1)}
              sx={{ color: "#1976d2", borderColor: "#d8dfe7", fontWeight: 600, fontSize: "13px", transition: "all 0.2s ease", "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)", borderColor: "#1976d2" } }}
            >{t("next")}</Button>
          </ButtonGroup>
          <TextField
            type="date"
            size="small"
            value={toDateInputValue(date)}
            onChange={(e) => { onNavigate(new Date(`${e.target.value}T00:00:00`)); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 145 }}
          />
        </Stack>
      </Box>

      {/* Month Grid – wrapped for horizontal scroll on mobile */}
      <div className="calendar-month-scroll">
        <div className="calendar-month-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="month-head">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const inCurrentMonth = day.getMonth() === date.getMonth();
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const dayItems = sortByStartTime(
            reservations.filter((item) => overlapsPeriod(item, dayStart, dayEnd))
          );

          return (
            <div 
              key={day.toISOString()} 
              className={`month-cell ${inCurrentMonth ? "" : "dim"}`}
              onClick={() => inCurrentMonth && handleCellClick(day)}
              style={{ cursor: inCurrentMonth ? "pointer" : "default" }}
            >
              <div className="month-date">{day.getDate()}</div>
              <div className="month-events">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="month-event-line"
                    onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                    style={{ cursor: "pointer", borderRadius: "4px", padding: "1px 4px", transition: "background 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(25,118,210,0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = ""}
                  >
                    <span>{item.room_name}</span>
                    <span className={statusClass(item.status)}>
                      {statusLabel[item.status]}
                    </span>
                  </div>
                ))}
                {dayItems.length > 3 && <small>+{dayItems.length - 3} more</small>}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {/* New Reservation Modal */}
      <NewReservationModal
        open={modalOpen}
        onClose={handleModalClose}
        rooms={rooms}
        form={form}
        setForm={setForm}
        onSubmit={handleFormSubmit}
        selectedRoom={selectedRoomId}
      />

      {/* Reservation Detail Popup */}
      <Dialog open={!!detailItem} onClose={() => setDetailItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, pr: 1, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eef2f7" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 4, height: 24, bgcolor: "#1976d2", borderRadius: "2px" }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e" }}>Reservation Detail</Typography>
          </Stack>
          <IconButton size="small" onClick={() => setDetailItem(null)} sx={{ color: "#5d7186", "&:hover": { bgcolor: "#eef2f7" } }}>✕</IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {detailItem && (
            <Box>
              {/* Room + Status header band */}
              <Box sx={{ bgcolor: "#f8f9fa", px: 3, py: 2, borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "11px" }}>Room</Typography>
                  <FloorPlanTooltip roomId={detailItem.room_id} roomName={detailItem.room_name}>
                    <Typography fontWeight={700} sx={{ color: "#1976d2", fontSize: "16px" }}>{detailItem.room_name}</Typography>
                  </FloorPlanTooltip>
                </Box>
                <Chip
                  label={statusLabel[detailItem.status] || detailItem.status}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: "12px",
                    px: 0.5,
                    bgcolor: detailItem.status === "approved" ? "rgba(34,185,86,0.12)" :
                              detailItem.status === "pending"  ? "rgba(246,197,77,0.18)" :
                              detailItem.status === "rejected" ? "rgba(249,92,92,0.12)" :
                              "rgba(25,118,210,0.12)",
                    color: detailItem.status === "approved" ? "#22b956" :
                           detailItem.status === "pending"  ? "#b07d00" :
                           detailItem.status === "rejected" ? "#f95c5c" :
                           "#1976d2",
                  }}
                />
              </Box>

              <Stack sx={{ px: 3, py: 2 }} spacing={2}>
                {/* Time */}
                <Box sx={{ bgcolor: "#f0f4ff", borderRadius: "8px", p: 1.5 }}>
                  <Stack direction="row" spacing={3}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px" }}>Start</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#313b5e" }}>{formatDateTime(detailItem.start_time)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", color: "#5d7186" }}>→</Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px" }}>End</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#313b5e" }}>{formatDateTime(detailItem.end_time)}</Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* Requester info */}
                <Box>
                  <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px", mb: 0.5, display: "block" }}>Requester</Typography>
                  <Box sx={{ border: "1px solid #eef2f7", borderRadius: "8px", overflow: "hidden" }}>
                    {[
                      { label: "Name", value: detailItem.requester_name },
                      { label: "Phone", value: detailItem.phone },
                      { label: "Email", value: detailItem.email },
                      { label: "Attendees", value: detailItem.attendees },
                    ].map(({ label, value }, i) => (
                      <Stack key={label} direction="row" sx={{ px: 1.5, py: 0.75, bgcolor: i % 2 === 0 ? "white" : "#fafbfc", borderBottom: i < 3 ? "1px solid #eef2f7" : "none" }}>
                        <Typography variant="body2" sx={{ color: "#5d7186", width: 80, flexShrink: 0 }}>{label}</Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ color: "#313b5e" }}>{value}</Typography>
                      </Stack>
                    ))}
                  </Box>
                </Box>

                {/* Purpose */}
                {detailItem.purpose && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px", mb: 0.5, display: "block" }}>Purpose</Typography>
                    <Typography variant="body2" sx={{ bgcolor: "#f8f9fa", border: "1px solid #eef2f7", p: 1.5, borderRadius: "8px", color: "#313b5e" }}>{detailItem.purpose}</Typography>
                  </Box>
                )}

                {/* Notes */}
                {detailItem.notes && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px", mb: 0.5, display: "block" }}>Notes</Typography>
                    <Typography variant="body2" sx={{ bgcolor: "#f8f9fa", border: "1px solid #eef2f7", p: 1.5, borderRadius: "8px", color: "#313b5e" }}>{detailItem.notes}</Typography>
                  </Box>
                )}

                {/* Admin Comment */}
                {detailItem.admin_comment && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: "10px", mb: 0.5, display: "block" }}>Admin Comment</Typography>
                    <Typography variant="body2" sx={{ bgcolor: "#fff8e1", border: "1px solid #ffe082", p: 1.5, borderRadius: "8px", color: "#7a5800" }}>{detailItem.admin_comment}</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
