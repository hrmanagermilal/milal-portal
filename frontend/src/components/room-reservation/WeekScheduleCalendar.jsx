import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { statusLabel } from "../../constants";
import { addDays, formatDateTime, startOfWeek, toDateInputValue } from "../../utils/datetime";
import DataMart from "../../common/DataMart";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";
import NewReservationModal from "./NewReservationModal";
import FloorPlanTooltip from "./FloorPlanTooltip";
import { useLanguage } from "../../i18n/LanguageContext";
import ReservedItem from "./ReservedItem";
const HOUR_START = 7;
const HOUR_END = 19; // 7AM – 7PM = 12 slots
const TOTAL_HOURS = HOUR_END - HOUR_START;
const ROOM_COL_W = 110;
const ROW_H = 56;

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
  const { t } = useLanguage();
  const weekStart = startOfWeek(date);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today     = new Date();

  const [localReservations, setLocalReservations] = useState(reservations || []);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [form, setForm] = useState({
    room_id: "", requester_name: "", phone: "", email: "",
    start_time: "", end_time: "", purpose: "", attendees: "1", notes: "",
  });

  // Auto-refresh reservations every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
      } catch (err) {
        console.error("[WeekScheduleCalendar] Failed to refresh reservations:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to reservation creation events for immediate refresh
  useEffect(() => {
    const handleReservationCreated = async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
      } catch (err) {
        console.error("[WeekScheduleCalendar] Failed to refresh after reservation created:", err);
      }
    };

    EventPublisher.addEventListener(EventDef.onReservationCreated, "WEEKVIEW", handleReservationCreated);

    return () => {
      EventPublisher.removeEventListener(EventDef.onReservationCreated, "WEEKVIEW", handleReservationCreated);
    };
  }, []);

  function openModal(roomId, day, slotHour) {
    const start = new Date(day);
    start.setHours(slotHour, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    setSelectedRoomId(roomId);
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
    setSelectedRoomId(null);
    setForm({ room_id: "", requester_name: "", phone: "", email: "", start_time: "", end_time: "", purpose: "", attendees: "1", notes: "" });
  }

  return (
    <Box>
      {/* Navigation bar */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
        {/* Left: date range label */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: { xs: "13px", md: "15px" }, color: "#313b5e", order: { xs: 2, md: 1 }, width: { xs: "100%", md: "auto" }, textAlign: { xs: "center", md: "left" } }}>
          {weekDays[0].toLocaleDateString([], { month: "short", day: "numeric" })}
          {" – "}
          {weekDays[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </Typography>

        {/* Right: Prev/Today/Next + date picker */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ order: { xs: 1, md: 2 }, ml: { xs: 0, md: "auto" } }}>
          <ButtonGroup size="small" variant="outlined">
            {[[t("prev"), -1], [t("today"), 0], [t("next"), 1]].map(([label, dir]) => (
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
            sx={{ width: 145 }}
          />
        </Stack>
      </Box>

      {/* Schedule grid */}
      <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", border: "1px solid #d8dfe7", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

        {/* Header: Room label + Day columns */}
        <Box sx={{ display: "flex", minWidth: "max-content", borderBottom: "2px solid #d8dfe7", bgcolor: "#eef2f7", position: "sticky", top: 0, zIndex: 3 }}>
          {/* Top-left corner */}
          <Box sx={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, flexShrink: 0, borderRight: "2px solid #d8dfe7", px: 1.5, py: 1.5, display: "flex", alignItems: "flex-end", position: "sticky", left: 0, zIndex: 4, bgcolor: "#eef2f7" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#5d7186", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: "11px" }}>
              {t("room")}
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
            sx={{ display: "flex", minWidth: "max-content", borderBottom: "1px solid #eef2f7", "&:last-child": { borderBottom: "none" } }}
          >
            {/* Room name cell */}
            <Box
              sx={{
                width: ROOM_COL_W, minWidth: ROOM_COL_W, flexShrink: 0,
                height: ROW_H, px: 1.5, display: "flex", alignItems: "center",
                borderRight: "2px solid #d8dfe7", bgcolor: "#fafbfc",
                position: "sticky", left: 0, zIndex: 2,
              }}
            >
              <FloorPlanTooltip roomId={room.id} roomName={room.name}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#1976d2", lineHeight: 1.3, fontSize: "13px" }}>
                  {room.name}
                </Typography>
              </FloorPlanTooltip>
            </Box>

            {/* Day cells */}
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const events  = getEventsForRoomDay(localReservations, room.id, day);

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
                    const placement = getEventPosition(item);
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          left: placement.left,
                          width: placement.width,
                          height: "100%",
                          zIndex: 1,
                        }}
                      >
                        <ReservedItem
                          item={item}
                          placement={placement}
                          compact={true}
                        />
                      </div>
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
        onSubmit={(formData) => { if (onSubmitReservation) onSubmitReservation(formData); closeModal(); }}
        selectedRoom={selectedRoomId}
        currentUser={DataMart.getCurrentUser()}
      />
    </Box>
  );
}
