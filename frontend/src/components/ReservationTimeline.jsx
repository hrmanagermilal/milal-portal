import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { calendarModes, statusLabel } from "../constants";
import {
  addDays,
  formatDateTime,
  overlapsPeriod,
  sortByStartTime,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "../utils/datetime";
import DayViewCalendar from "./DayViewCalendar";
import WeekScheduleCalendar from "./WeekScheduleCalendar";
import MonthViewCalendar from "./MonthViewCalendar";

const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  changed: "info",
  rejected: "error",
};

function buildWindowForDay(date) {
  const start = new Date(date);
  start.setHours(6, 0, 0, 0);
  const end = new Date(date);
  end.setHours(22, 0, 0, 0);
  return { start, end };
}

export default function ReservationTimeline({ rooms, reservations, onCreateReservation }) {
  const [mode, setMode] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const floorFilteredRooms = useMemo(() => {
    if (selectedFloor === "all") return rooms;
    return rooms.filter((r) => String(r.floor) === selectedFloor);
  }, [rooms, selectedFloor]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((item) => {
      if (selectedFloor !== "all" && !floorFilteredRooms.some((r) => r.id === item.room_id)) return false;
      if (selectedRoom !== "all" && String(item.room_id) !== selectedRoom) return false;
      if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
      return true;
    });
  }, [reservations, selectedFloor, floorFilteredRooms, selectedRoom, selectedStatus]);

  const visibleRange = useMemo(() => {
    if (mode === "day") {
      return buildWindowForDay(anchorDate);
    }
    if (mode === "week") {
      const start = buildWindowForDay(startOfWeek(anchorDate)).start;
      const end = buildWindowForDay(endOfWeek(anchorDate)).end;
      return { start, end };
    }
    return {
      start: startOfMonth(anchorDate),
      end: endOfMonth(anchorDate),
    };
  }, [mode, anchorDate]);

  const visibleList = useMemo(
    () => sortByStartTime(filteredReservations.filter((item) => overlapsPeriod(item, visibleRange.start, visibleRange.end))),
    [filteredReservations, visibleRange]
  );

  function handleNavigate(direction) {
    if (direction === 0) {
      // Today button
      setAnchorDate(new Date());
    } else if (mode === "day") {
      setAnchorDate((prev) => addDays(prev, direction));
    } else if (mode === "week") {
      setAnchorDate((prev) => addDays(prev, direction * 7));
    } else if (mode === "month") {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, prev.getDate()));
    }
  }

  function handleDateChange(newDate) {
    if (typeof newDate === "string") {
      setAnchorDate(new Date(`${newDate}T00:00:00`));
    } else {
      setAnchorDate(newDate);
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        {/* View Mode Selector */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <ButtonGroup size="small" variant="outlined">
            {calendarModes.map((m) => (
              <Button
                key={m}
                variant={mode === m ? "contained" : "outlined"}
                onClick={() => setMode(m)}
                sx={{
                  bgcolor: mode === m ? "#1976d2" : "transparent",
                  color: mode === m ? "white" : "#1976d2",
                  borderColor: "#1976d2",
                  fontWeight: 600,
                  fontSize: "12px",
                  letterSpacing: "0.5px",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: mode === m ? "#1565c0" : "rgba(25, 118, 210, 0.08)",
                    borderColor: "#1976d2",
                  },
                  boxShadow: mode === m ? "0 4px 12px rgba(25, 118, 210, 0.3)" : "none",
                }}
              >
                {m.toUpperCase()}
              </Button>
            ))}
          </ButtonGroup>

          <Box sx={{ flexGrow: 1 }} />

          <TextField
            select
            size="small"
            label="Floor"
            value={selectedFloor}
            onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom("all"); }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">All Floors</MenuItem>
            <MenuItem value="1">1st Floor</MenuItem>
            <MenuItem value="2">2nd Floor</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Room"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">All Rooms</MenuItem>
            {floorFilteredRooms.map((room) => (
              <MenuItem key={room.id} value={String(room.id)}>{room.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            {Object.keys(statusLabel).map((status) => (
              <MenuItem key={status} value={status}>{statusLabel[status]}</MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Calendar Views */}
        {mode === "day" && (
          <DayViewCalendar
            date={anchorDate}
            rooms={floorFilteredRooms}
            reservations={filteredReservations}
            onNavigate={handleNavigate}
            onSubmitReservation={onCreateReservation}
          />
        )}
        {mode === "week" && (
          <WeekScheduleCalendar
            date={anchorDate}
            rooms={floorFilteredRooms}
            reservations={filteredReservations}
            onNavigate={(directionOrDate) => {
              if (typeof directionOrDate === "number") {
                handleNavigate(directionOrDate);
              } else {
                handleDateChange(directionOrDate);
              }
            }}
            onSubmitReservation={onCreateReservation}
          />
        )}
        {mode === "month" && (
          <MonthViewCalendar
            date={anchorDate}
            rooms={rooms}
            reservations={filteredReservations}
            onNavigate={(directionOrDate) => {
              if (typeof directionOrDate === "number") {
                handleNavigate(directionOrDate);
              } else {
                handleDateChange(directionOrDate);
              }
            }}
            onSubmitReservation={onCreateReservation}
          />
        )}

        {/* Detail list */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Detailed Reservation List (Visible Period)
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: "#eef2f7" }}>
                <TableRow>
                  {["ID", "Room", "Time", "Requester", "Purpose", "Status", "Admin Note"].map((h) => (
                    <TableCell key={h} sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleList.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.room_name}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(item.start_time)}<br />{formatDateTime(item.end_time)}
                    </TableCell>
                    <TableCell>
                      {item.requester_name}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {item.phone} / {item.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.purpose}</TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel[item.status] || item.status}
                        color={STATUS_COLOR[item.status] || "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{item.admin_comment || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </CardContent>
    </Card>
  );
}