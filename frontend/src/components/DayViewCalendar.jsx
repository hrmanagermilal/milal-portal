import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  addDays,
  formatDateTime,
  toDateInputValue,
} from "../utils/datetime";
import { statusLabel } from "../constants";
import NewReservationModal from "./NewReservationModal";

const STATUS_COLORS = {
  pending:  { bg: "rgba(246,197,77,0.18)",  border: "#f6c54d", text: "#b07d00" },
  approved: { bg: "rgba(34,185,86,0.12)",   border: "#22b956", text: "#155e2a" },
  changed:  { bg: "rgba(25,118,210,0.12)",  border: "#1976d2", text: "#0d47a1" },
  rejected: { bg: "rgba(249,92,92,0.12)",   border: "#f95c5c", text: "#b71c1c" },
};

const HOUR_START = 6;
const HOUR_END = 22;

function buildWindowForDay(date) {
  const start = new Date(date);
  start.setHours(HOUR_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(HOUR_END, 0, 0, 0);
  return { start, end };
}

function toHourText(value) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sortByStartTime(items) {
  return items.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function overlapsPeriod(item, periodStart, periodEnd) {
  const itemStart = new Date(item.start_time);
  const itemEnd = new Date(item.end_time);
  return !(itemEnd <= periodStart || itemStart >= periodEnd);
}

export default function DayViewCalendar({ date, rooms, reservations, onNavigate, onSubmitReservation }) {
  const { t } = useLanguage();
  const { start: dayStart, end: dayEnd } = buildWindowForDay(date);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
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

  const handleCellClick = (roomId, cellDateTime) => {
    setSelectedRoomId(roomId);
    setSelectedDateTime(cellDateTime);
    
    // Set the room_id in form
    setForm((prev) => ({
      ...prev,
      room_id: String(roomId),
      start_time: cellDateTime.toISOString().slice(0, 16),
      end_time: new Date(cellDateTime.getTime() + 3600000).toISOString().slice(0, 16),
    }));
    
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
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
        {/* Left: date label */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: { xs: "13px", md: "15px" }, color: "#313b5e", order: { xs: 2, md: 1 }, width: { xs: "100%", md: "auto" }, textAlign: { xs: "center", md: "left" } }}>
          {date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
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

      {/* Day Grid – wrapped for horizontal scroll with sticky room column */}
      <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", mb: 2, border: "2px solid #dde2ee", borderRadius: "4px" }}>
      <Box
        className="calendar-day-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: '140px repeat(16, 1fr)',
          gap: 0,
          minWidth: "max-content",
          bgcolor: 'white',
          overflow: 'visible',
        }}
      >
        {/* Hour Headers */}
        <div className="calendar-day-head calendar-day-head--sticky">Room</div>
        {Array.from({ length: HOUR_END - HOUR_START }, (_, idx) => HOUR_START + idx).map((hour) => (
          <div key={`header-${hour}`} className="calendar-day-head">
            {String(hour).padStart(2, "0")}
          </div>
        ))}

        {/* Room Rows */}
        {rooms.map((room) => {
          const isAvailable = reservations.filter(
            (item) => item.room_id === room.id && overlapsPeriod(item, dayStart, dayEnd)
          ).length === 0;

          return (
            <Fragment key={room.id}>
              <div 
                className="room-cell room-name" 
                style={{ color: isAvailable ? "#1976d2" : "inherit" }}
              >
                {room.name}
              </div>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, idx) => HOUR_START + idx).map((hour) => {
                const cellStart = new Date(date);
                cellStart.setHours(hour, 0, 0, 0);
                const cellEnd = new Date(cellStart);
                cellEnd.setHours(hour + 1, 0, 0, 0);

                const items = sortByStartTime(
                  reservations.filter(
                    (item) => item.room_id === room.id && overlapsPeriod(item, cellStart, cellEnd)
                  )
                );

                return (
                  <div 
                    key={`${room.id}-${hour}`} 
                    className="event-track-am-pm"
                    onClick={() => handleCellClick(room.id, cellStart)}
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`time-block time-block-${item.status}`}
                        title={`${item.requester_name} | ${toHourText(new Date(item.start_time))} - ${toHourText(new Date(item.end_time))}`}
                        onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                        style={{ cursor: "pointer" }}
                      >
                        <strong>{item.requester_name}</strong>
                        <span>{toHourText(new Date(item.start_time))}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </Box>
      </Box>

      {/* New Reservation Modal */}
      <NewReservationModal
        open={modalOpen}
        onClose={handleModalClose}
        rooms={rooms}
        form={form}
        setForm={setForm}
        onSubmit={handleFormSubmit}
        selectedRoom={selectedRoomId}
        selectedDateTime={selectedDateTime}
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
