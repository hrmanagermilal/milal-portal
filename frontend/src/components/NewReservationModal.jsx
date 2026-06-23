import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../i18n/LanguageContext";

// Default end = start + 1 hour, clamped to 23:30 of same day
function computeEndTime(startValue) {
  if (!startValue) return "";
  const startDate = startValue.slice(0, 10);
  const startDt = new Date(startValue);
  const endDt = new Date(startDt.getTime() + 3600000);
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

export default function NewReservationModal({
  open,
  onClose,
  rooms,
  form,
  setForm,
  onSubmit,
  selectedRoom,
  selectedDateTime,
}) {
  const { t } = useLanguage();

  function field(key) {
    return {
      value: form[key],
      onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  function handleStartTimeChange(e) {
    const startValue = e.target.value;
    setForm((prev) => ({
      ...prev,
      start_time: startValue,
      end_time: computeEndTime(startValue),
    }));
  }

  const startDate = form.start_time ? form.start_time.slice(0, 10) : "";
  const endTimeOnly = form.end_time ? form.end_time.slice(11, 16) : "";

  const isValid =
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
    form.phone.trim() &&
    form.email.trim() &&
    form.start_time &&
    form.end_time &&
    form.purpose.trim() &&
    Number(form.attendees) >= 1;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(e);
    onClose();
  }

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
          <Stack spacing={2}>
            <TextField select label={t("fieldRoom")} fullWidth required {...field("room_id")}>
              {[1, 2].map((floor) => {
                const floorRooms = rooms.filter((r) => (r.floor ?? 1) === floor);
                if (floorRooms.length === 0) return null;
                return [
                  <ListSubheader key={`floor-${floor}`} sx={{ fontWeight: 700, color: "#1976d2", fontSize: "12px", lineHeight: "32px" }}>
                    {floor === 1 ? t("floor1Label") : t("floor2Label")}
                  </ListSubheader>,
                  ...floorRooms.map((room) => (
                    <MenuItem key={room.id} value={String(room.id)}>
                      {room.name} ({t("capacity")} {room.capacity})
                    </MenuItem>
                  )),
                ];
              })}
            </TextField>

            <TextField label={t("name")} fullWidth required {...field("requester_name")} />

            <TextField label={t("phone")} fullWidth required placeholder="###-####-####" {...field("phone")} />

            <TextField label={t("email")} type="email" fullWidth required {...field("email")} />

            <TextField
              label={t("fieldStartTime")} type="datetime-local" fullWidth required
              InputLabelProps={{ shrink: true }}
              value={form.start_time}
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
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} variant="outlined" sx={{ bgcolor: "#fdfdfd", color: "#5554547b" }}>
          {t("cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid}
          sx={{ bgcolor: "#2f68f9", "&:disabled": { bgcolor: "#d8dfe7", color: "#a0aab4" } }}
        >
          {t("submitRequest")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
