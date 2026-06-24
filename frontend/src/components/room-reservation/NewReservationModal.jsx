import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../../i18n/LanguageContext";
import { dateToLocalISOString } from "../../utils/datetime";
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
  isCardMode = false,
}) {
  const { t } = useLanguage();
  
  // Get unique floors from rooms
  const floors = Array.from(new Set(rooms.map(r => r.floor ?? 1))).sort();
  const selectedFloor = form.floor || "all";
  const floorRooms = selectedFloor === "all" ? [] : rooms.filter(r => (r.floor ?? 1) === Number(selectedFloor));
  const [showRoomSelector, setShowRoomSelector] = useState(false);

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

  // Set user info when modal opens
  useEffect(() => {
    if (open && currentUser) {
      setForm((prev) => ({
        ...prev,
        requester_name: currentUser.name || "",
        phone: currentUser.phone || "",
        email: currentUser.email || ""
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
    Number(form.attendees) >= 1;

  console.log("[NewReservationModal] isValid:", isValid, "form:", form);
  console.log("[NewReservationModal] currentUser:", currentUser);

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid) {
      onSubmit(form); // Pass form object, not event
    }
    if (!isCardMode) {
      onClose();
    }
  }

  // Common form JSX content
  const formFields = (
    <Stack spacing={2}>
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
          {floorRooms.map((room) => (
            <MenuItem key={room.id} value={String(room.id)}>
              {room.name} ({t("capacity")} {room.capacity})
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => setShowRoomSelector(true)}
          disabled={selectedFloor === "all"}
          sx={{
            flexShrink: 0,
            minWidth: 120,
            fontSize: "12px",
            fontWeight: 600,
            color: selectedFloor === "all" ? "#a0aab4" : "#1976d2",
            borderColor: selectedFloor === "all" ? "#d8dfe7" : "#1976d2",
            "&:hover": {
              bgcolor: selectedFloor === "all" ? "transparent" : "rgba(25,118,210,0.08)"
            }
          }}
        >
          맵으로 선택
        </Button>
      </Stack>

      <TextField
        label={t("fieldStartTime")} type="datetime-local" fullWidth required
        InputLabelProps={{ shrink: true }}
        value={startTimeEST}
        onChange={handleStartTimeChange}
      />

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

      <TextField label={t("purpose")} fullWidth required multiline rows={2} {...field("purpose")} />

      <TextField label={t("attendees")} type="number" fullWidth required inputProps={{ min: 1 }} {...field("attendees")} />

      <TextField label={t("notes")} fullWidth multiline rows={2} {...field("notes")} />

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
          disabled={!isValid}
        >
          {t("submitRequest")}
        </Button>
      </Stack>
    </Stack>
  );

  // Room Selector Dialog (shared)
  const roomSelectorDialog = (
    <Dialog
      open={showRoomSelector}
      onClose={() => setShowRoomSelector(false)}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ pb: 1, pr: 1, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eef2f7" }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e", fontSize: "15px" }}>
          {selectedFloor === "all" ? t("selectFloor") : `${Number(selectedFloor) === 1 ? t("floor1Label") : t("floor2Label")} - ${t("selectRoom")}`}
        </Typography>
        <IconButton size="small" onClick={() => setShowRoomSelector(false)} sx={{ color: "#5d7186" }}>
          ✕
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {selectedFloor !== "all" && (
          <FloorPlanTooltip
            mode="select"
            floor={Number(selectedFloor)}
            roomId={form.room_id || 0}
            roomName=""
            onSelectRoom={handleSelectRoomFromMap}
          />
        )}
      </DialogContent>
    </Dialog>
  );

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
