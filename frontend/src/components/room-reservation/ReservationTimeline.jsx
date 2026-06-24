import { useMemo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
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
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { calendarModes } from "../../constants";
import { useLanguage } from "../../i18n/LanguageContext";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";
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
} from "../../utils/datetime";
import DayViewCalendar from "./DayViewCalendar";
import WeekScheduleCalendar from "./WeekScheduleCalendar";
import MonthViewCalendar from "./MonthViewCalendar";
import FloorPlanTooltip from "./FloorPlanTooltip";

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

export default function ReservationTimeline({ rooms, reservations, onCreateReservation, guideText }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useLanguage();
  const displayGuideText = guideText || t("timelineGuideText");

  const statusLabel = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    changed: t("statusChanged"),
    rejected: t("statusRejected"),
  };

  const [mode, setMode] = useState("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showList, setShowList] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [localReservations, setLocalReservations] = useState(reservations || []);

  // 5-second polling for reservations
  useEffect(() => {
    const loadReservations = async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
      } catch (err) {
        console.error("Failed to load reservations:", err);
      }
    };

    loadReservations();
    const interval = setInterval(loadReservations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to reservation creation events
  useEffect(() => {
    const handleReservationCreated = async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
        console.log("[ReservationTimeline] Reservation created event received, updated reservations.", data);
      } catch (err) {
        console.error("Failed to refresh reservations:", err);
      }
    };

    EventPublisher.addEventListener(EventDef.onReservationCreated, "TIMELINE", handleReservationCreated);
    return () => EventPublisher.removeEventListener(EventDef.onReservationCreated, "TIMELINE", handleReservationCreated);
  }, []);

  const floorFilteredRooms = useMemo(() => {
    if (selectedFloor === "all") return rooms;
    return rooms.filter((r) => String(r.floor) === selectedFloor);
  }, [rooms, selectedFloor]);

  const filteredReservations = useMemo(() => {
    return localReservations.filter((item) => {
      if (selectedFloor !== "all" && !floorFilteredRooms.some((r) => r.id === item.room_id)) return false;
      if (selectedRoom !== "all" && String(item.room_id) !== selectedRoom) return false;
      if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
      return true;
    });
  }, [localReservations, selectedFloor, floorFilteredRooms, selectedRoom, selectedStatus]);

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
    () => {
      const list = sortByStartTime(filteredReservations.filter((item) => overlapsPeriod(item, visibleRange.start, visibleRange.end)));
      return list;
    },
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
      <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
        <Typography variant="body2" sx={{ color: "#5d7186", mb: 2 }}>
          {displayGuideText}
        </Typography>
        {/* View Mode Selector + Filters */}
        <Stack spacing={2.5} sx={{ mb: 2.5 }}>
          {/* Row 1: Filters (left) + DAY / WEEK / MONTH toggle (right) */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            {/* Filter Group – left aligned */}
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ flex: 1, "& .MuiTextField-root": { flex: { xs: "1 1 calc(50% - 8px)", md: "0 0 auto" } } }}
            >
              <TextField select size="small" label={t("filterFloor")} value={selectedFloor}
                onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom("all"); }}
                sx={{ minWidth: { xs: 0, md: 120 } }}
              >
                <MenuItem value="all">{t("filterAllFloors")}</MenuItem>
                <MenuItem value="1">{t("filterFloor1")}</MenuItem>
                <MenuItem value="2">{t("filterFloor2")}</MenuItem>
              </TextField>
              <TextField select size="small" label={t("filterRoom")} value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                sx={{ minWidth: { xs: 0, md: 140 } }}
              >
                <MenuItem value="all">{t("filterAllRooms")}</MenuItem>
                {floorFilteredRooms.map((room) => (
                  <MenuItem key={room.id} value={String(room.id)}>{room.name}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label={t("filterStatus")} value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                sx={{ minWidth: { xs: 0, md: 130 } }}
              >
                <MenuItem value="all">{t("filterAllStatus")}</MenuItem>
                {Object.keys(statusLabel).map((s) => (
                  <MenuItem key={s} value={s}>{statusLabel[s]}</MenuItem>
                ))}
              </TextField>
            </Stack>

            {/* View Mode Toggle – right aligned */}
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
                  {t(m)}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
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
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: showList ? 1.5 : 0 }}
          >
            <Typography variant="subtitle2" sx={{ color: "#5d7186", fontWeight: 700, fontSize: "13px" }}>
              Detailed Reservation List
              {showList && (
                <Typography component="span" sx={{ ml: 1, color: "#8486a7", fontWeight: 400, fontSize: "12px" }}>
                  ({visibleList.length} items)
                </Typography>
              )}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setShowList((v) => !v)}
              sx={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#1976d2",
                borderColor: "#d8dfe7",
                textTransform: "none",
                minWidth: 0,
                px: 1.5,
                py: 0.4,
                "&:hover": { borderColor: "#1976d2", bgcolor: "rgba(25,118,210,0.06)" },
              }}
            >
              {showList ? t("detailListHide") : t("detailListShow")}
            </Button>
          </Box>

          <Collapse in={showList}>
            {isMobile ? (
              /* ── Mobile: compact card list ── */
              <Stack spacing={0} sx={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
                {visibleList.length === 0 ? (
                  <Typography sx={{ p: 2, color: "#8486a7", fontSize: "13px", textAlign: "center" }}>{t("noReservationsVisible")}</Typography>
                ) : visibleList.map((item, idx) => {
                  if (idx === 0) console.log("[ReservationTimeline] First item in list:", item);
                  return (
                  <Box
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      px: 1.5, py: 1.2,
                      borderBottom: idx < visibleList.length - 1 ? "1px solid #eef2f7" : "none",
                      bgcolor: idx % 2 === 0 ? "white" : "#fafbfc",
                      cursor: "pointer",
                      "&:active": { bgcolor: "rgba(25,118,210,0.06)" },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <FloorPlanTooltip roomId={item.room_id} roomName={item.room_name}>
                        <Typography sx={{ fontWeight: 600, fontSize: "13px", color: "#1976d2", lineHeight: 1.3 }}>
                          {item.room_name}
                        </Typography>
                      </FloorPlanTooltip>
                      <Typography sx={{ fontSize: "11px", color: "#5d7186", mt: 0.3 }}>
                        {new Date(item.start_time).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(item.end_time).toLocaleString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </Box>
                    <Chip
                      label={statusLabel[item.status] || item.status}
                      color={STATUS_COLOR[item.status] || "default"}
                      size="small"
                      sx={{ ml: 1, flexShrink: 0, fontSize: "10px", height: 20 }}
                    />
                  </Box>
                );
                })}
              </Stack>
            ) : (
              /* ── Desktop: full table ── */
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#eef2f7" }}>
                    <TableRow>
                      {[t("colId"), t("colRoom"), t("colTime"), t("colRequester"), t("colPurpose"), t("colStatus"), t("colAdminNote")].map((h) => (
                        <TableCell key={h} sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleList.map((item) => (
                      <TableRow key={item.id} hover sx={{ cursor: "pointer" }} onClick={() => setSelectedItem(item)}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>
                          <FloorPlanTooltip roomId={item.room_id} roomName={item.room_name}>
                            <span>{item.room_name}</span>
                          </FloorPlanTooltip>
                        </TableCell>
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
            )}
          </Collapse>
        </Box>

        {/* Detail popup dialog */}
        <Dialog
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1, pr: 1, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eef2f7" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 4, height: 24, bgcolor: "#1976d2", borderRadius: "2px" }} />
                <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e", fontSize: "15px" }}>{t("reservationDetail")}</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setSelectedItem(null)} sx={{ color: "#5d7186" }}>✕</IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {selectedItem && (
              <Box>
                <Box sx={{ bgcolor: "#f8f9fa", px: 2.5, py: 1.5, borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px" }}>Room</Typography>
                    <FloorPlanTooltip roomId={selectedItem.room_id} roomName={selectedItem.room_name}>
                      <Typography fontWeight={700} sx={{ color: "#1976d2", fontSize: "15px" }}>{selectedItem.room_name}</Typography>
                    </FloorPlanTooltip>
                  </Box>
                  <Chip
                    label={statusLabel[selectedItem.status] || selectedItem.status}
                    color={STATUS_COLOR[selectedItem.status] || "default"}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Stack sx={{ px: 2.5, py: 2 }} spacing={1.5}>
                  <Box sx={{ bgcolor: "#f0f4ff", borderRadius: "8px", p: 1.5 }}>
                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px" }}>{t("fieldStart")}</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatDateTime(selectedItem.start_time)}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", color: "#5d7186" }}>→</Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px" }}>{t("fieldEnd")}</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatDateTime(selectedItem.end_time)}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Divider />
                  {[
                    { label: t("fieldName"),    value: selectedItem.requester_name },
                    { label: t("fieldPhone"),   value: selectedItem.phone },
                    { label: t("fieldEmail"),   value: selectedItem.email },
                    { label: t("fieldAttendees"), value: selectedItem.attendees },
                    { label: t("colPurpose"),   value: selectedItem.purpose },
                    ...(selectedItem.notes ? [{ label: t("fieldNotes"), value: selectedItem.notes }] : []),
                    ...(selectedItem.admin_comment ? [{ label: t("fieldAdminComment"), value: selectedItem.admin_comment }] : []),
                  ].map(({ label, value }) => (
                    <Stack key={label} direction="row" spacing={1}>
                      <Typography variant="body2" sx={{ color: "#5d7186", width: 90, flexShrink: 0, fontSize: "12px" }}>{label}</Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ color: "#313b5e", fontSize: "12px", wordBreak: "break-word" }}>{value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}