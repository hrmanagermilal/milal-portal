import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { statusLabel } from "../constants";
import { addDays, formatDateTime, startOfWeek, toDateInputValue } from "../utils/datetime";
import NewReservationModal from "./NewReservationModal";

const HOUR_START = 7;
const HOUR_END = 19; // 7AM – 7PM = 12 slots
const TOTAL_HOURS = HOUR_END - HOUR_START;
const ROOM_COL_W = 150;
const ROW_H = 56;

const STATUS_COLORS = {
  pending:  { bg: "rgba(246,197,77,0.28)",  border: "#f6c54d", text: "#7a5800" },
  approved: { bg: "rgba(34,185,86,0.20)",   border: "#22b956", text: "#155e2a" },
  changed:  { bg: "rgba(25,118,210,0.20)",  border: "#1976d2", text: "#0d47a1" },
  rejected: { bg: "rgba(249,92,92,0.20)",   border: "#f95c5c", text: "#b71c1c" },
};

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEventPosition(item) {
  const gridStartMins = HOUR_START * 60;
  const totalMins = TOTAL_HOURS * 60;
  const startMins = new Date(item.start_time).getHours() * 60 + new Date(item.start_time).getMinutes();
  const endMins   = new Date(item.end_time).getHours()   * 60 + new Date(item.end_time).getMinutes();
  const cStart = Math.max(startMins, gridStartMins);
  const cEnd   = Math.min(endMins,   gridStartMins + totalMins);
  return {
    left:  `${((cStart - gridStartMins) / totalMins) * 100}%`,
    width: `${Math.max((cEnd - cStart) / totalMins * 100, 1.5)}%`,
  };
}

function getEventsForRoomDay(reservations, roomId, day) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(day); d1.setHours(23, 59, 59, 999);
  return reservations.filter((item) => {
    if (item.room_id !== roomId) return false;
    const s = new Date(item.start_time);
    const e = new Date(item.end_time);
    return !(e <= d0 || s >= d1);
  });
}

export default function WeekScheduleCalendar({ date, rooms, reservations, onNavigate, onSubmitReservation }) {
  const weekStart = startOfWeek(date);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today     = new Date();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [form, setForm] = useState({
    room_id: "", requester_name: "", phone: "", email: "",
    start_time: "", end_time: "", purpose: "", attendees: "1", notes: "",
  });

  function openModal(roomId, day, slotHour) {
    const start = new Date(day);
    start.setHours(slotHour, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setForm((prev) => ({
      ...prev,
      room_id: String(roomId),
      start_time: start.toISOString().slice(0, 16),
      end_time:   end.toISOString().slice(0, 16),
    }));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm({ room_id: "", requester_name: "", phone: "", email: "", start_time: "", end_time: "", purpose: "", attendees: "1", notes: "" });
  }

  return (
    <Box>
      {/* Navigation bar */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <ButtonGroup size="small" variant="outlined">
          {[["Prev", -1], ["Today", 0], ["Next", 1]].map(([label, dir]) => (
            <Button
              key={label}
              onClick={() => onNavigate(dir)}
              sx={{
                color: "#1976d2", borderColor: "#d8dfe7", fontWeight: 600, fontSize: "13px",
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: "rgba(25,118,210,0.08)", borderColor: "#1976d2" },
              }}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>

        <TextField
          type="date"
          size="small"
          value={toDateInputValue(date)}
          onChange={(e) => onNavigate(new Date(`${e.target.value}T00:00:00`))}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1, textAlign: "center" }}>
          {weekDays[0].toLocaleDateString([], { month: "short", day: "numeric" })}
          {" – "}
          {weekDays[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </Typography>
      </Stack>

      {/* Schedule grid */}
      <Box sx={{ overflowX: "auto", border: "1px solid #d8dfe7", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

        {/* Header: Room label + Day columns */}
        <Box sx={{ display: "flex", borderBottom: "2px solid #d8dfe7", bgcolor: "#eef2f7", position: "sticky", top: 0, zIndex: 3 }}>
          {/* Top-left corner */}
          <Box sx={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, flexShrink: 0, borderRight: "2px solid #d8dfe7", px: 1.5, py: 1.5, display: "flex", alignItems: "flex-end" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "11px" }}>
              Room
            </Typography>
          </Box>

          {/* Day + hour tick headers */}
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <Box
                key={day.toISOString()}
                sx={{ flex: 1, minWidth: 160, borderRight: "1px solid #d8dfe7", "&:last-child": { borderRight: "none" }, bgcolor: isToday ? "rgba(25,118,210,0.07)" : "transparent" }}
              >
                {/* Day label */}
                <Box sx={{ textAlign: "center", py: 1, borderBottom: "1px solid #d8dfe7" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isToday ? "#1976d2" : "#313b5e", display: "block", fontSize: "12px" }}>
                    {day.toLocaleDateString([], { weekday: "short" })}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isToday ? "#1976d2" : "#5d7186", fontWeight: isToday ? 700 : 400, fontSize: "11px" }}>
                    {day.toLocaleDateString([], { month: "numeric", day: "numeric" })}
                  </Typography>
                </Box>

                {/* 12 hour-tick labels */}
                <Box sx={{ display: "flex", height: 18 }}>
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <Box key={i} sx={{ flex: 1, borderLeft: i > 0 ? "1px solid #d8dfe7" : "none", pl: "3px" }}>
                      <Typography sx={{ fontSize: "9px", color: "#8486a7", lineHeight: 1.8, fontWeight: 500 }}>
                        {HOUR_START + i}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Room rows */}
        {rooms.map((room) => (
          <Box
            key={room.id}
            sx={{ display: "flex", borderBottom: "1px solid #eef2f7", "&:last-child": { borderBottom: "none" } }}
          >
            {/* Room name cell */}
            <Box
              sx={{
                width: ROOM_COL_W, minWidth: ROOM_COL_W, flexShrink: 0,
                height: ROW_H, px: 1.5, display: "flex", alignItems: "center",
                borderRight: "2px solid #d8dfe7", bgcolor: "#fafbfc",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: "#1976d2", lineHeight: 1.3, fontSize: "13px" }}>
                {room.name}
              </Typography>
            </Box>

            {/* Day cells */}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const events  = getEventsForRoomDay(reservations, room.id, day);

              return (
                <Box
                  key={day.toISOString()}
                  onClick={() => openModal(room.id, day, HOUR_START)}
                  sx={{
                    flex: 1, minWidth: 160, height: ROW_H,
                    position: "relative", cursor: "pointer",
                    borderRight: "1px solid #eef2f7",
                    "&:last-child": { borderRight: "none" },
                    bgcolor: isToday ? "rgba(25,118,210,0.03)" : "white",
                    "&:hover": { bgcolor: isToday ? "rgba(25,118,210,0.07)" : "#f8f9fa" },
                    transition: "background 0.15s",
                  }}
                >
                  {/* 12 full-height vertical slot dividers */}
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none", zIndex: 0 }}>
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          height: "100%",
                          borderLeft: i > 0 ? "1px solid #eef2f7" : "none",
                        }}
                      />
                    ))}
                  </Box>

                  {/* Events */}
                  {events.map((item) => {
                    const { left, width } = getEventPosition(item);
                    const colors = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
                    return (
                      <Tooltip
                        key={item.id}
                        arrow
                        title={
                          <Box>
                            <Typography sx={{ fontSize: "12px", fontWeight: 700 }}>{item.room_name}</Typography>
                            <Typography sx={{ fontSize: "11px" }}>{item.requester_name}</Typography>
                            <Typography sx={{ fontSize: "11px" }}>{statusLabel[item.status]}</Typography>
                          </Box>
                        }
                      >
                        <Box
                          onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                          sx={{
                            position: "absolute",
                            top: "5px", bottom: "5px",
                            left, width,
                            bgcolor: colors.bg,
                            border: `1.5px solid ${colors.border}`,
                            borderRadius: "4px",
                            zIndex: 1,
                            px: "4px",
                            display: "flex",
                            alignItems: "center",
                            overflow: "hidden",
                            cursor: "default",
                            minWidth: "4px",
                          }}
                        >
                          <Typography sx={{ fontSize: "10px", fontWeight: 700, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>
                            {item.requester_name}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      <NewReservationModal
        open={modalOpen}
        onClose={closeModal}
        rooms={rooms}
        form={form}
        setForm={setForm}
        onSubmit={(e) => { e.preventDefault(); if (onSubmitReservation) onSubmitReservation(form); closeModal(); }}
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
              <Box sx={{ bgcolor: "#f8f9fa", px: 3, py: 2, borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "11px" }}>Room</Typography>
                  <Typography fontWeight={700} sx={{ color: "#1976d2", fontSize: "16px" }}>{detailItem.room_name}</Typography>
                </Box>
                <Chip label={statusLabel[detailItem.status] || detailItem.status} size="small"
                  sx={{ fontWeight: 700, fontSize: "12px", px: 0.5,
                    bgcolor: STATUS_COLORS[detailItem.status]?.bg || "#eee",
                    color: STATUS_COLORS[detailItem.status]?.text || "#333",
                  }}
                />
              </Box>
              <Stack sx={{ px: 3, py: 2 }} spacing={2}>
                <Box sx={{ bgcolor: "#f0f4ff", borderRadius: "8px", p: 1.5 }}>
                  <Stack direction="row" spacing={3}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px" }}>Start</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#313b5e" }}>{formatDateTime(detailItem.start_time)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", color: "#5d7186" }}>→</Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px" }}>End</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#313b5e" }}>{formatDateTime(detailItem.end_time)}</Typography>
                    </Box>
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", mb: 0.5, display: "block" }}>Requester</Typography>
                  <Box sx={{ border: "1px solid #eef2f7", borderRadius: "8px", overflow: "hidden" }}>
                    {[{ label: "Name", value: detailItem.requester_name }, { label: "Phone", value: detailItem.phone }, { label: "Email", value: detailItem.email }, { label: "Attendees", value: detailItem.attendees }]
                      .map(({ label, value }, i) => (
                        <Stack key={label} direction="row" sx={{ px: 1.5, py: 0.75, bgcolor: i % 2 === 0 ? "white" : "#fafbfc", borderBottom: i < 3 ? "1px solid #eef2f7" : "none" }}>
                          <Typography variant="body2" sx={{ color: "#5d7186", width: 80, flexShrink: 0 }}>{label}</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ color: "#313b5e" }}>{value}</Typography>
                        </Stack>
                    ))}
                  </Box>
                </Box>
                {detailItem.purpose && (<Box><Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", mb: 0.5, display: "block" }}>Purpose</Typography><Typography variant="body2" sx={{ bgcolor: "#f8f9fa", border: "1px solid #eef2f7", p: 1.5, borderRadius: "8px", color: "#313b5e" }}>{detailItem.purpose}</Typography></Box>)}
                {detailItem.notes && (<Box><Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", mb: 0.5, display: "block" }}>Notes</Typography><Typography variant="body2" sx={{ bgcolor: "#f8f9fa", border: "1px solid #eef2f7", p: 1.5, borderRadius: "8px", color: "#313b5e" }}>{detailItem.notes}</Typography></Box>)}
                {detailItem.admin_comment && (<Box><Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", mb: 0.5, display: "block" }}>Admin Comment</Typography><Typography variant="body2" sx={{ bgcolor: "#fff8e1", border: "1px solid #ffe082", p: 1.5, borderRadius: "8px", color: "#7a5800" }}>{detailItem.admin_comment}</Typography></Box>)}
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
