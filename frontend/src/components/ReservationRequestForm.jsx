import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

function computeEndTime(startValue) {
  if (!startValue) return "";
  const startDate = startValue.slice(0, 10);
  const startDt = new Date(startValue);
  const endDt = new Date(startDt.getTime() + 3600000);
  const maxEnd = new Date(`${startDate}T23:30`);
  return (endDt > maxEnd ? maxEnd : endDt).toISOString().slice(0, 16);
}

function minEndTime(startValue) {
  if (!startValue) return "00:00";
  const dt = new Date(startValue);
  dt.setMinutes(dt.getMinutes() + 30);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

export default function ReservationRequestForm({ rooms, form, setForm, onSubmit }) {
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

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reservation Request
        </Typography>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField select label="Room" fullWidth required {...field("room_id")}>
                {rooms.map((room) => (
                  <MenuItem key={room.id} value={String(room.id)}>
                    {room.name} (capacity {room.capacity})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Name" fullWidth required {...field("requester_name")} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Phone" fullWidth required placeholder="010-1234-5678" {...field("phone")} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Email" type="email" fullWidth required {...field("email")} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Start Time"
                type="datetime-local"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={form.start_time}
                onChange={handleStartTimeChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" sx={{ color: "#5d7186", display: "block", mb: 0.75, fontSize: "12px", fontWeight: 500 }}>
                  End Time *
                  {startDate && (
                    <Chip label={startDate} size="small" sx={{ ml: 1, height: 18, fontSize: "11px", bgcolor: "rgba(25,118,210,0.1)", color: "#1976d2", fontWeight: 600 }} />
                  )}
                </Typography>
                <Stack direction="row" alignItems="center">
                  <TextField
                    type="time"
                    size="small"
                    fullWidth
                    required
                    value={endTimeOnly}
                    disabled={!form.start_time}
                    inputProps={{ min: minEndTime(form.start_time), max: "23:59" }}
                    helperText={!form.start_time ? "시작 시간을 먼저 선택하세요" : `최소 ${minEndTime(form.start_time)} 이후`}
                    onChange={(e) => {
                      if (!startDate) return;
                      const selected = e.target.value;
                      const min = minEndTime(form.start_time);
                      // If selected time is before minimum, snap to minimum
                      const enforced = selected < min ? min : selected;
                      setForm((prev) => ({ ...prev, end_time: `${startDate}T${enforced}` }));
                    }}
                  />
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Attendees"
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
                required
                {...field("attendees")}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField label="Purpose" fullWidth required {...field("purpose")} />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Additional Notes"
                multiline
                rows={4}
                fullWidth
                {...field("notes")}
              />
            </Grid>

            <Grid item xs={12}>
              <Button type="submit" variant="contained" size="large" sx={{ bgcolor: "#2f68f9" }}>
                Submit Reservation Request
              </Button>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
}
