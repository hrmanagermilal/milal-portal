import { Fragment, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import {
  addDays,
  endOfWeek,
  startOfWeek,
  toDateInputValue,
  toHourText,
} from "../../utils/datetime";
import DataMart from "../../common/DataMart";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";
import NewReservationModal from "./NewReservationModal";
import FloorPlanTooltip from "./FloorPlanTooltip";
import ReservedItem from "./ReservedItem";

const HOUR_START = 6;
const HOUR_END = 22;

function buildWindowForDay(date) {
  const start = new Date(date);
  start.setHours(HOUR_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(HOUR_END, 0, 0, 0);
  return { start, end };
}

function calcEventPlacement(item, windowStart, windowEnd) {
  const sourceStart = new Date(item.start_time);
  const sourceEnd = new Date(item.end_time);
  const start = sourceStart > windowStart ? sourceStart : windowStart;
  const end = sourceEnd < windowEnd ? sourceEnd : windowEnd;

  if (end <= start) return null;

  const total = windowEnd.getTime() - windowStart.getTime();
  const left = ((start.getTime() - windowStart.getTime()) / total) * 100;
  const width = ((end.getTime() - start.getTime()) / total) * 100;

  return {
    left,
    width: Math.max(width, 1.2),
    text: `${toHourText(sourceStart)} - ${toHourText(sourceEnd)}`,
  };
}

function TimeAxis() {
  const marks = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, idx) => HOUR_START + idx);
  return (
    <div className="time-axis">
      {marks.map((hour) => (
        <span key={hour}>{String(hour).padStart(2, "0")}</span>
      ))}
    </div>
  );
}

function EventBars({ items, windowStart, windowEnd, onCellClick, roomId }) {
  const placements = items
    .map((item) => ({ item, placement: calcEventPlacement(item, windowStart, windowEnd) }))
    .filter((entry) => entry.placement !== null);

  const dynamicHeight = Math.max(58, placements.length * 24 + 10);

  const handleCellClick = (e) => {
    // Only handle click if not on a ReservedItem
    if (e.target.closest('.time-block')) {
      return;
    }
    
    // Calculate time based on click position within the cell
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const cellHeight = rect.height;
    
    // Total minutes in the window
    const totalMinutes = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60);
    const clickMinutes = (clickY / cellHeight) * totalMinutes;
    
    // Calculate clicked time
    const clickedTime = new Date(windowStart.getTime() + clickMinutes * 60 * 1000);
    
    // Round to nearest 30 minutes
    const minutes = clickedTime.getMinutes();
    clickedTime.setMinutes(minutes < 15 ? 0 : minutes < 45 ? 30 : 0);
    if (minutes >= 45) {
      clickedTime.setHours(clickedTime.getHours() + 1);
    }
    
    onCellClick(roomId, clickedTime);
  };

  return (
    <div 
      className="event-track" 
      style={{ minHeight: `${dynamicHeight}px`, cursor: "pointer", position: "relative" }}
      onClick={handleCellClick}
    >
      {placements.map(({ item, placement }) => (
        <div
          key={item.id}
          style={{
            position: "absolute",
            left: `${placement.left}%`,
            width: `${placement.width}%`,
            top: 0,
            height: "100%",
            zIndex: 10,
          }}
        >
          <ReservedItem
            item={item}
            placement={placement}
          />
        </div>
      ))}
    </div>
  );
}

function sortByStartTime(items) {
  return items.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function overlapsPeriod(item, periodStart, periodEnd) {
  const itemStart = new Date(item.start_time);
  const itemEnd = new Date(item.end_time);
  return !(itemEnd <= periodStart || itemStart >= periodEnd);
}

function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function WeekViewCalendar({ date, rooms, reservations, onNavigate, onSubmitReservation }) {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));

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
        console.error("[WeekViewCalendar] Failed to refresh reservations:", err);
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
        console.error("[WeekViewCalendar] Failed to refresh after reservation created:", err);
      }
    };

    EventPublisher.addEventListener(EventDef.onReservationCreated, "WEEKVIEW_SUB", handleReservationCreated);

    return () => {
      EventPublisher.removeEventListener(EventDef.onReservationCreated, "WEEKVIEW_SUB", handleReservationCreated);
    };
  }, []);

  const handleCellClick = (roomId, cellDateTime) => {
    setSelectedRoomId(roomId);
    setSelectedDateTime(cellDateTime);
    
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
      floor: "",
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
  };

  const handleFormSubmit = (formData) => {
    if (onSubmitReservation) {
      const processedData = {
        ...formData,
        room_id: Number(formData.room_id),
        attendees: Number(formData.attendees),
        repeat_count: Number(formData.repeat_count),
        permission: formData.permission || "member",
      };
      onSubmitReservation(processedData);
    }
    handleModalClose();
  };

  return (
    <Box>
      {/* Navigation */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <ButtonGroup size="small" variant="outlined">
          <Button 
            onClick={() => onNavigate(-1)}
            sx={{
              color: "#1976d2",
              borderColor: "#d8dfe7",
              fontWeight: 600,
              fontSize: "13px",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "rgba(25, 118, 210, 0.08)",
                borderColor: "#1976d2",
              },
            }}
          >
            Prev
          </Button>
          <Button 
            onClick={() => onNavigate(0)}
            sx={{
              color: "#1976d2",
              borderColor: "#d8dfe7",
              fontWeight: 600,
              fontSize: "13px",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "rgba(25, 118, 210, 0.08)",
                borderColor: "#1976d2",
              },
            }}
          >
            Today
          </Button>
          <Button 
            onClick={() => onNavigate(1)}
            sx={{
              color: "#1976d2",
              borderColor: "#d8dfe7",
              fontWeight: 600,
              fontSize: "13px",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "rgba(25, 118, 210, 0.08)",
                borderColor: "#1976d2",
              },
            }}
          >
            Next
          </Button>
        </ButtonGroup>

        <TextField
          type="date"
          size="small"
          value={toDateInputValue(date)}
          onChange={(e) => {
            const newDate = new Date(`${e.target.value}T00:00:00`);
            onNavigate(newDate);
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1, textAlign: "center" }}>
          {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
        </Typography>
      </Stack>

      {/* Week Grid */}
      <div className="calendar-week-view">
        <div className="calendar-grid-header room-col">Room</div>
        {weekDays.map((day) => (
          <div 
            key={day.toISOString()} 
            className="calendar-grid-header"
            style={{
              backgroundColor: isToday(day) ? "#dde7ff" : "#f3f7ff",
              fontWeight: isToday(day) ? "bold" : "700",
            }}
          >
            {day.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}
          </div>
        ))}

        {rooms.map((room) => {
          const isAvailable = weekDays.every((day) => {
            const { start: dayStart, end: dayEnd } = buildWindowForDay(day);
            return localReservations.filter(
              (item) => item.status !== "rejected" && item.room_id === room.id && overlapsPeriod(item, dayStart, dayEnd)
            ).length === 0;
          });

          return (
            <Fragment key={`week-room-${room.id}`}>
              <div 
                className="calendar-grid-cell room-col room-name"
                style={{ color: isAvailable ? "#1976d2" : "inherit" }}
              >
                <FloorPlanTooltip roomName={room.name}>
                  <span>{room.name}</span>
                </FloorPlanTooltip>
              </div>
              {weekDays.map((day) => {
                const { start: dayStart, end: dayEnd } = buildWindowForDay(day);
                const items = sortByStartTime(
                  localReservations.filter(
                    (item) => item.status !== "rejected" && item.room_id === room.id && overlapsPeriod(item, dayStart, dayEnd)
                  )
                );

                return (
                  <div 
                    key={`${room.id}-${day.toISOString()}`} 
                    className="calendar-grid-cell"
                    style={{
                      backgroundColor: isToday(day) ? "#eef2ff" : "transparent",
                    }}
                  >
                    <EventBars 
                      items={items} 
                      windowStart={dayStart} 
                      windowEnd={dayEnd}
                      onCellClick={handleCellClick}
                      roomId={room.id}
                    />
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      {/* New Reservation Modal */}
      <NewReservationModal
        open={modalOpen}
        onClose={handleModalClose}
        rooms={rooms}
        reservations={localReservations}
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
