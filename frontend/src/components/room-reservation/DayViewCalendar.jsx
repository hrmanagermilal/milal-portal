import { Fragment, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import FloorPlanTooltip from "./FloorPlanTooltip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  addDays,
  toDateInputValue,
  toHourText,
  dateToLocalISOString,
} from "../../utils/datetime";
import { useLanguage } from "../../i18n/LanguageContext";
import DataMart from "../../common/DataMart";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";
import NewReservationModal from "./NewReservationModal";
import ReservedItem from "./ReservedItem";

const HOUR_START = 6;
const HOUR_END = 22;  // 06:00 ~ 21:00 (마지막 셀은 21시)

function buildWindowForDay(date) {
  const start = new Date(date);
  start.setHours(HOUR_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(HOUR_END, 0, 0, 0);
  return { start, end };
}

function sortByStartTime(items) {
  return items.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function getEventsForRoomDay(reservations, roomId, day) {
  // Filter by room and entire day (0:00~23:59) - avoids timezone issues
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(day);
  d1.setHours(23, 59, 59, 999);
  
  return reservations.filter((item) => {
    if (item.status === "rejected") return false; // Exclude rejected
    if (item.room_id !== roomId) return false;
    const s = new Date(item.start_time);
    const e = new Date(item.end_time);
    return !(e <= d0 || s >= d1);
  });
}



export default function DayViewCalendar({ date, rooms, reservations, onNavigate, onSubmitReservation }) {
  const { t } = useLanguage();
  const { start: dayStart, end: dayEnd } = buildWindowForDay(date);
  
  const [localReservations, setLocalReservations] = useState(reservations || []);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
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
    permission: "member",
    repeat_type: "none",
    repeat_count: 1,
  });

  // Auto-refresh reservations every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
      } catch (err) {
        console.error("[DayViewCalendar] Failed to refresh reservations:", err);
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
        console.error("[DayViewCalendar] Failed to refresh after reservation created:", err);
      }
    };

    EventPublisher.addEventListener(EventDef.onReservationCreated, "DAYVIEW", handleReservationCreated);

    return () => {
      EventPublisher.removeEventListener(EventDef.onReservationCreated, "DAYVIEW", handleReservationCreated);
    };
  }, []);

  const handleCellClick = (roomId, cellDateTimeStart, cellDateTimeEnd) => {
    setSelectedRoomId(roomId);
    setSelectedDateTime(cellDateTimeStart);
    
    // Convert local Date objects to ISO strings preserving local time (EDT, not UTC)
    const startTimeStr = dateToLocalISOString(cellDateTimeStart);
    const endTimeStr = dateToLocalISOString(cellDateTimeEnd);
    
    console.log(`[DayViewCalendar] handleCellClick: roomId=${roomId}, start=${startTimeStr}, end=${endTimeStr}`);
    
    setForm((prev) => ({
      ...prev,
      room_id: String(roomId),
      start_time: startTimeStr,
      end_time: endTimeStr
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

  const handleFormSubmit = (formData) => {
    if (onSubmitReservation) {
      // Convert data types for backend API
      const processedData = {
        ...formData,
        room_id: Number(formData.room_id), // Convert to int
        attendees: Number(formData.attendees), // Convert to int
        repeat_count: Number(formData.repeat_count), // Convert to int
        permission: formData.permission || "member", // Include permission
        // start_time and end_time are already in correct format (local ISO string)
      };
      onSubmitReservation(processedData);
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
          const roomDayItems = getEventsForRoomDay(localReservations, room.id, date);
          const isAvailable = roomDayItems.length === 0;

          return (
            <Fragment key={room.id}>
              {/* Room Name - First Column */}
              <FloorPlanTooltip roomId={room.id} roomName={room.name}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: isAvailable ? "#1976d2" : "inherit",
                    lineHeight: 1.3,
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  className="room-cell room-name"
                >
                  {room.name}
                </Typography>
              </FloorPlanTooltip>

              {/* Hours Area - Spans all hour columns */}
              <Box
                sx={{
                  gridColumn: `2 / span ${HOUR_END - HOUR_START}`,
                  position: "relative",
                  minHeight: "80px",
                  bgcolor: "#fafbfc",
                  borderBottom: "1px solid #dde2ee",
                  borderRight: "1px solid #dde2ee",
                  display: "grid",
                  gridTemplateColumns: `repeat(${HOUR_END - HOUR_START}, 1fr)`,
                }}
              >
                {/* Render empty hour cells for grid alignment */}
                {Array.from(
                  { length: HOUR_END - HOUR_START },
                  (_, idx) => HOUR_START + idx
                ).map((hour) => {
                  const cellStart = new Date(date);
                  const cellEnd = new Date(date);
                  cellStart.setHours(hour, 0, 0, 0);
                  cellEnd.setHours(hour + 1, 0, 0, 0);

                  return (
                    <Box
                      key={`${room.id}-${hour}`}
                      sx={{
                        borderRight: "1px solid #dde2ee",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          bgcolor: "rgba(25, 118, 210, 0.05)",
                        },
                      }}
                      onClick={() => handleCellClick(room.id, cellStart, cellEnd)}
                    />
                  );
                })}

                {/* Render Reserved Items as absolute overlay */}
                {roomDayItems.map((item) => (
                  <ReservedItem
                    key={item.id}
                    item={item}
                    startHour={HOUR_START}
                    endHour={HOUR_END}
                    hourRange={HOUR_END - HOUR_START}
                  />
                ))}
              </Box>
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
        currentUser={DataMart.getCurrentUser()}
      />
    </Box>
  );
}
