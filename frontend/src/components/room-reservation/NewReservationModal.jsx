import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";
import { dateToLocalISOString, isPastTime } from "../../utils/datetime";
import { evaluateRuleForSlot, groupRulesByRoom } from "../../utils/reservationRules";

// Calculate max date (3 months from today)
function getMaxReservationDate() {
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  return dateToLocalISOString(maxDate).slice(0, 16);
}

// Check if date is more than 3 months in the future
function isTooFarFuture(dateTimeStr) {
  if (!dateTimeStr) return false;
  const selectedDate = new Date(dateTimeStr + 'Z');
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  return selectedDate > maxDate;
}
import FloorPlanTooltip from "./FloorPlanTooltip";

// Default end = start + 1 hour, clamped to 23:30 of same day
function computeEndTime(startValue) {
  if (!startValue) return "";
  
  // Parse local time string "2026-06-15T03:00"
  const [datePart, timePart] = startValue.split('T');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes] = timePart.split(':');
  
  // Create Date object from local time components
  const startDt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  
  // Add 1 hour
  const endDt = new Date(startDt.getTime() + 3600000);
  
  // Clamp to 23:30 of same day
  const maxEnd = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 30);
  const finalEnd = endDt > maxEnd ? maxEnd : endDt;
  
  // Convert back to local ISO string format
  return dateToLocalISOString(finalEnd);
}

// Minimum end time = start time + 30 min
function minEndTime(startValue) {
  if (!startValue) return "00:00";
  
  // Parse local time string "2026-06-15T03:00"
  const [datePart, timePart] = startValue.split('T');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes] = timePart.split(':');
  
  // Create Date object from local time components
  const startDt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  
  // Add 30 minutes
  startDt.setMinutes(startDt.getMinutes() + 30);
  
  return `${String(startDt.getHours()).padStart(2, "0")}:${String(startDt.getMinutes()).padStart(2, "0")}`;
}

// form.start_time is already in EST (user input), no conversion needed
// This function is kept for reference but not used
function convertGMTtoEST(gmtTimeStr) {
  if (!gmtTimeStr || typeof gmtTimeStr !== 'string') return "";
  return gmtTimeStr; // Already in EST from user input
}

// Add 1 hour to EST time string
function addOneHourToESTTime(estTimeStr) {
  if (!estTimeStr) return "";
  const dt = new Date(estTimeStr + 'Z');
  const endDt = new Date(dt.getTime() + 3600000); // Add 1 hour
  return endDt.toISOString().slice(0, 16);
}

export default function NewReservationModal({
  open,
  onClose,
  rooms,
  form,
  setForm,
  onSubmit,
  selectedRoom,
  selectedDateTime,
  currentUser,
  reservationRules = [],
  isCardMode = false,
}) {
  const { t } = useLanguage();
  const hasSelectedTimeRange =
    typeof form.start_time === "string" &&
    typeof form.end_time === "string" &&
    form.start_time &&
    form.end_time &&
    form.end_time > form.start_time;
  const [availableRooms, setAvailableRooms] = useState(rooms);
  const availableRoomIds = new Set(availableRooms.map((room) => room.id));
  const rulesByRoom = groupRulesByRoom(reservationRules);
  
  // Get unique floors from rooms
  const floors = Array.from(new Set(rooms.map(r => r.floor ?? 1))).sort();
  const selectedFloor = form.floor || "all";
  const floorRooms = selectedFloor === "all" ? [] : availableRooms.filter(r => (r.floor ?? 1) === Number(selectedFloor));
  const [showRoomSelector, setShowRoomSelector] = useState(false);

  useEffect(() => {
    setAvailableRooms(rooms);
  }, [rooms]);

  // form.start_time and form.end_time are already in EST (from user input)
  const startTimeEST = form.start_time; // Already EST
  const startDate = (form.start_time && typeof form.start_time === 'string') ? form.start_time.slice(0, 10) : "";
  const endTimeOnly = (form.end_time && typeof form.end_time === 'string') ? form.end_time.slice(11, 16) : "";

  // Set floor and room when modal opens with selectedRoom
  useEffect(() => {
    if (open && selectedRoom) {
      const room = rooms.find(r => r.id === selectedRoom);
      if (room) {
        setForm((prev) => ({
          ...prev,
          floor: String(room.floor ?? 1),
          room_id: String(selectedRoom)
        }));
      }
    }
  }, [open, selectedRoom, rooms, setForm]);

  useEffect(() => {
    if (!form.room_id) {
      return;
    }

    if (!availableRoomIds.has(Number(form.room_id))) {
      setForm((prev) => ({
        ...prev,
        room_id: "",
      }));
    }
  }, [availableRoomIds, form.room_id, setForm]);

  useEffect(() => {
    if (!open && !isCardMode) {
      return;
    }

    if (!hasSelectedTimeRange) {
      setAvailableRooms(rooms);
      return;
    }

    let cancelled = false;

    async function loadAvailableRooms() {
      try {
        const data = await api.getAvailableRooms(form.start_time, form.end_time);
        if (!cancelled) {
          setAvailableRooms(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("[NewReservationModal] Failed to load available rooms:", err);
        if (!cancelled) {
          setAvailableRooms([]);
        }
      }
    }

    loadAvailableRooms();

    return () => {
      cancelled = true;
    };
  }, [form.end_time, form.start_time, hasSelectedTimeRange, isCardMode, open, rooms]);

  // Set user info when modal opens
  useEffect(() => {
    if (open && currentUser) {
      setForm((prev) => ({
        ...prev,
        requester_name: currentUser.name || "",
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        permission: currentUser.permission || "member"
      }));
    }
  }, [open, currentUser, setForm]);

  // Set start time and end time when selectedDateTime changes
  useEffect(() => {
    if (open && selectedDateTime) {
      let startTimeStr = "";
      
      // Handle both Date objects and strings
      if (selectedDateTime instanceof Date) {
        // Use dateToLocalISOString to preserve local time (EDT, not UTC)
        startTimeStr = dateToLocalISOString(selectedDateTime);
      } else if (typeof selectedDateTime === 'string') {
        startTimeStr = selectedDateTime.slice(0, 16);
      }
      
      if (startTimeStr) {
        const endTimeStr = computeEndTime(startTimeStr);
        setForm((prev) => ({
          ...prev,
          start_time: startTimeStr,
          end_time: endTimeStr,
        }));
      }
    }
  }, [open, selectedDateTime, setForm]);

  function field(key) {
    return {
      value: form[key],
      onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }
  
  function handleFloorChange(e) {
    const newFloor = e.target.value;
    setForm((prev) => ({ 
      ...prev, 
      floor: newFloor,
      room_id: "" // Reset room when floor changes
    }));
  }
  
  function handleSelectRoomFromMap(roomId) {
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (selectedRoom) {
      setForm((prev) => ({
        ...prev,
        room_id: String(roomId)
      }));
      setShowRoomSelector(false);
    }
  }

  function handleStartTimeChange(e) {
    const startValue = e.target.value;
    setForm((prev) => ({
      ...prev,
      start_time: startValue,
      end_time: computeEndTime(startValue),
    }));
  }

  const isValid =
    form.floor &&
    form.floor !== "all" &&
    form.room_id &&
    form.requester_name.trim() &&
    form.phone.trim() &&
    form.email.trim() &&
    form.start_time &&
    form.end_time &&
    typeof form.start_time === 'string' &&
    typeof form.end_time === 'string' &&
    form.end_time > form.start_time &&
    form.end_time.slice(0, 10) === form.start_time.slice(0, 10) &&
    form.purpose.trim() &&
    Number(form.attendees) >= 1 &&
    !isPastTime(form.start_time) &&
    !isTooFarFuture(form.start_time);

  const roomIdNumber = Number(form.room_id);
  const hasRuleCheckInputs = Boolean(roomIdNumber && form.start_time && form.end_time);
  const ruleCheckResult = hasRuleCheckInputs
    ? evaluateRuleForSlot({
        rulesByRoom,
        roomId: roomIdNumber,
        startDate: new Date(form.start_time),
        endDate: new Date(form.end_time),
        currentUser,
      })
    : { allowed: true, reason: "" };
  const blockedByRule = !ruleCheckResult.allowed;

  console.log("[NewReservationModal] isValid:", isValid, "form:", form);
  console.log("[NewReservationModal] currentUser:", currentUser);

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid && !blockedByRule) {
      onSubmit(form); // Pass form object, not event
    }
    if (!isCardMode) {
      onClose();
    }
  }

  // Common form JSX content
  const formFields = (
    <Stack spacing={2}>
 
      <TextField
        label={t("fieldStartTime")} type="datetime-local" fullWidth required
        InputLabelProps={{ shrink: true }}
        value={startTimeEST}
        onChange={handleStartTimeChange}
        inputProps={{ max: getMaxReservationDate() }}
      />

      {blockedByRule && (
        <Alert severity="warning">
          {ruleCheckResult.reason || "선택한 시간은 예약 규칙에 의해 허용되지 않습니다."}
        </Alert>
      )}

      <Box>
        <Typography variant="caption" sx={{ color: "#5d7186", display: "block", mb: 0.75, fontSize: "12px", fontWeight: 500 }}>
          {t("fieldEndTime")} *
          {startDate && (
            <Chip label={startDate} size="small" sx={{ ml: 1, height: 18, fontSize: "11px", bgcolor: "rgba(25,118,210,0.1)", color: "#1976d2", fontWeight: 600 }} />
          )}
        </Typography>
        <TextField
          type="time" size="small" fullWidth required
          value={endTimeOnly}
          disabled={!form.start_time}
          inputProps={{ min: minEndTime(form.start_time), max: "23:59" }}
          onChange={(e) => {
            if (!form.start_time) return;
            const selected = e.target.value;
            const min = minEndTime(form.start_time);
            const enforced = selected < min ? min : selected;
            const dateStr = form.start_time.slice(0, 10);
            setForm((prev) => ({ ...prev, end_time: `${dateStr}T${enforced}` }));
          }}
        />
      </Box>

           {/* Floor Selection */}
      <TextField 
        select 
        label={t("filterFloor")} 
        fullWidth 
        required 
        value={selectedFloor}
        onChange={handleFloorChange}
      >
        <MenuItem value="all" disabled>{t("selectFloor")}</MenuItem>
        {floors.map((floor) => (
          <MenuItem key={floor} value={String(floor)}>
            {floor === 1 ? t("floor1Label") : t("floor2Label")}
          </MenuItem>
        ))}
      </TextField>

      {/* Room Selection with Map Button */}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField 
          select 
          label={t("fieldRoom")} 
          fullWidth 
          required 
          disabled={selectedFloor === "all"}
          {...field("room_id")}
        >
          <MenuItem value="" disabled>{t("selectRoom")}</MenuItem>
          {floorRooms.length === 0 && (
            <MenuItem value="__no_available_room__" disabled>
              {t("noAvailableRooms")}
            </MenuItem>
          )}
          {floorRooms.map((room) => (
            <MenuItem key={room.id} value={String(room.id)}>
              {room.name} ({t("capacity")} {room.capacity})
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => setShowRoomSelector(true)}
          disabled={selectedFloor === "all" || floorRooms.length === 0}
          sx={{
            flexShrink: 0,
            minWidth: 120,
            fontSize: "12px",
            fontWeight: 600,
            color: selectedFloor === "all" || floorRooms.length === 0 ? "#a0aab4" : "#1976d2",
            borderColor: selectedFloor === "all" || floorRooms.length === 0 ? "#d8dfe7" : "#1976d2",
            "&:hover": {
              bgcolor: selectedFloor === "all" || floorRooms.length === 0 ? "transparent" : "rgba(25,118,210,0.08)"
            }
          }}
        >
          맵으로 선택
        </Button>
      </Stack>

      <TextField label={t("purpose")} fullWidth required multiline rows={2} {...field("purpose")} />

      <TextField label={t("attendees")} type="number" fullWidth required inputProps={{ min: 1 }} {...field("attendees")} />

      <TextField label={t("notes")} fullWidth multiline rows={2} {...field("notes")} />

      {/* Admin Repeat Options */}
      {currentUser?.permission === "admin" && (
        <Box sx={{ pt: 1, pb: 1, px: 2, bgcolor: "rgba(47,104,249,0.05)", borderRadius: "8px", border: "1px solid rgba(47,104,249,0.2)" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#2f68f9", mb: 1.5, fontSize: "13px" }}>
            📅 반복 예약 설정 (관리자)
          </Typography>
          
          <Stack spacing={1.5}>
            <TextField
              select
              label="반복 유형"
              size="small"
              fullWidth
              value={form.repeat_type || "none"}
              onChange={(e) => setForm((prev) => ({ ...prev, repeat_type: e.target.value, repeat_count: 1 }))}
            >
              <MenuItem value="none">반복 없음</MenuItem>
              <MenuItem value="weekly">매주</MenuItem>
              <MenuItem value="monthly">매달</MenuItem>
            </TextField>

            {form.repeat_type === "weekly" || form.repeat_type === "monthly" ? (
              <>
                <TextField
                  label="반복 횟수"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 52 }}
                  value={form.repeat_count || 1}
                  onChange={(e) => setForm((prev) => ({ ...prev, repeat_count: Math.max(1, parseInt(e.target.value) || 1) }))}
                />
                <Typography variant="caption" sx={{ color: "#666", fontSize: "12px", fontStyle: "italic" }}>
                  💡 {form.repeat_count}개의 예약이 {form.repeat_type === "weekly" ? "매주" : "매달"} 생성되며, 모두 자동승인됩니다.
                </Typography>
              </>
            ) : null}
          </Stack>
        </Box>
      )}

      {/* Buttons */}
      <Stack direction="row" spacing={1.5} sx={{ width: "100%", justifyContent: "flex-end", pt: 1 }}>
        {!isCardMode && (
          <Button 
            type="button"
            variant="outlined" 
            sx={{ 
              color: "#5d7186",
              borderColor: "#d8dfe7",
              fontSize: "14px",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                borderColor: "#9aa4b1",
                bgcolor: "rgba(93,113,134,0.04)"
              }
            }}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
        )}
        <Button 
          type="submit"
          variant="contained" 
          sx={{ 
            bgcolor: "#2f68f9",
            fontSize: "14px",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#1e50c7"
            },
            "&:disabled": {
              bgcolor: "#d8dfe7",
              color: "#a0aab4"
            }
          }}
          disabled={!isValid || blockedByRule}
        >
          {t("submitRequest")}
        </Button>
      </Stack>
    </Stack>
  );

  // Room Selector Dialog (shared)
  const roomSelectorDialog = selectedFloor !== "all" ? (
    <FloorPlanTooltip
      mode="select"
      open={showRoomSelector}
      onClose={() => setShowRoomSelector(false)}
      floor={Number(selectedFloor)}
      roomId={form.room_id || 0}
      roomName={selectedFloor === "all" ? t("selectFloor") : `${Number(selectedFloor) === 1 ? t("floor1Label") : t("floor2Label")} - ${t("selectRoom")}`}
      onSelectRoom={(roomId) => {
        handleSelectRoomFromMap(roomId);
        setShowRoomSelector(false);
      }}
      visibleRoomIds={floorRooms.map((room) => room.id)}
    />
  ) : null;

  // Card mode: return form content only
  if (isCardMode) {
    return (
      <>
        <Box component="form" onSubmit={handleSubmit}>
          {formFields}
        </Box>
        {roomSelectorDialog}
      </>
    );
  }

  // Dialog mode: return Dialog with form content
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          width: "100%",
          maxWidth: { xs: "100%", sm: "540px" },
          m: { xs: 0, sm: "16px auto" },
          maxHeight: { xs: "100dvh", sm: "calc(100dvh - 32px)" },
          borderRadius: { xs: 0, sm: "12px" },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>{t("newReservationTitle")}</DialogTitle>
      <DialogContent sx={{ pt: "12px !important", pb: 1 }}>
        <Box component="form" onSubmit={handleSubmit}>
          {formFields}
        </Box>
      </DialogContent>

      {roomSelectorDialog}
    </Dialog>
  );
}
