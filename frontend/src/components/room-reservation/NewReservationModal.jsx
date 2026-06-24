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
import FloorPlanTooltip from "./FloorPlanTooltip";

// Default end = start + 1 hour, clamped to 23:30 of same day
function computeEndTime(startValue) {
  if (!startValue) return "";
  const startDate = startValue.slice(0, 10);
  const startDt = new Date(startValue);
  const endDt = new Date(startDt.getTime() + 3600000); // Add 1 hour (3600000ms)
  const maxEnd = new Date(`${startDate}T23:30`);
  return (endDt > maxEnd ? maxEnd : endDt).toISOString().slice(0, 16);
}

// Minimum end time = start time + 30 min
function minEndTime(startValue) {
  if (!startValue) return "00:00";
  const dt = new Date(startValue);
  dt.setMinutes(dt.getMinutes() + 30);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// Convert GMT to EST (UTC-5)
function convertGMTtoEST(gmtTimeStr) {
  if (!gmtTimeStr) return "";
  // gmtTimeStr: "2026-06-24T08:30"
  const dt = new Date(gmtTimeStr + 'Z'); // Z를 붙여서 UTC로 해석
  
  // EST로 변환 (UTC-5, 5시간 빼기)
  const estDt = new Date(dt.getTime() - 5 * 60 * 60 * 1000);
  
  // "2026-06-24T03:30" 형식으로 반환
  return estDt.toISOString().slice(0, 16);
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

  // Convert GMT times to EST for display
  const startTimeEST = convertGMTtoEST(form.start_time);
  const endTimeEST = addOneHourToESTTime(startTimeEST);

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
      const startTimeStr = selectedDateTime.toISOString().slice(0, 16);
      const endTimeStr = computeEndTime(startTimeStr);
      setForm((prev) => ({
        ...prev,
        start_time: startTimeStr,
        end_time: endTimeStr,
      }));
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

  const startDate = startTimeEST ? startTimeEST.slice(0, 10) : "";
  const endTimeOnly = endTimeEST ? endTimeEST.slice(11, 16) : "";

  const isValid =
    form.floor &&
    form.floor !== "all" &&
    form.room_id &&
    form.requester_name.trim() &&
    form.phone.trim() &&
    form.email.trim() &&
    form.start_time &&
    form.end_time &&
    form.end_time > form.start_time &&
    form.end_time.slice(0, 10) === form.start_time.slice(0, 10) &&
    form.purpose.trim() &&
    Number(form.attendees) >= 1;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(e);
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
          helperText={!form.start_time ? t("endTimeSelectStart") : t("endTimeMinHint").replace("%s", minEndTime(form.start_time))}
          onChange={(e) => {
            if (!startDate) return;
            const selected = e.target.value;
            const min = minEndTime(form.start_time);
            const enforced = selected < min ? min : selected;
            setForm((prev) => ({ ...prev, end_time: `${startDate}T${enforced}` }));
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
