import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";
import { getReservationMaxDateInputValue, isPastTime, isTooFarFuture } from "../../utils/datetime";
import { computeEndTime, minEndTime } from "./NewReservationModal";

// Lets an admin submit one shared time/purpose against several rooms at once;
// the parent creates one independent reservation per selected room.
export default function MultiRoomReservationRequestForm({ rooms, form, setForm, onSubmit, guideText, currentUser }) {
  const { t } = useLanguage();
  const [availableRooms, setAvailableRooms] = useState(rooms);
  const [floorFilter, setFloorFilter] = useState("all");
  const reservationMaxDateTime = getReservationMaxDateInputValue(1);
  const floors = Array.from(new Set(rooms.map((r) => r.floor ?? 1))).sort();

  const hasSelectedTimeRange =
    typeof form.start_time === "string" &&
    typeof form.end_time === "string" &&
    form.start_time &&
    form.end_time &&
    form.end_time > form.start_time;

  useEffect(() => {
    setAvailableRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    if (currentUser) {
      setForm((prev) => ({
        ...prev,
        requester_name: currentUser.name || "",
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        permission: currentUser.permission || "member",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!hasSelectedTimeRange) {
      setAvailableRooms(rooms);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getAvailableRooms(form.start_time, form.end_time);
        if (!cancelled) setAvailableRooms(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[MultiRoomReservationRequestForm] Failed to load available rooms:", err);
        if (!cancelled) setAvailableRooms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.start_time, form.end_time, hasSelectedTimeRange, rooms]);

  // Drop selections that are no longer available for the chosen time slot.
  useEffect(() => {
    const availableIds = new Set(availableRooms.map((r) => String(r.id)));
    setForm((prev) => {
      const filtered = (prev.room_ids || []).filter((id) => availableIds.has(String(id)));
      if (filtered.length === (prev.room_ids || []).length) return prev;
      return { ...prev, room_ids: filtered };
    });
  }, [availableRooms, setForm]);

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

  function toggleRoom(roomId) {
    setForm((prev) => {
      const selected = new Set((prev.room_ids || []).map(String));
      const key = String(roomId);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      return { ...prev, room_ids: Array.from(selected) };
    });
  }

  const startDate = form.start_time && typeof form.start_time === "string" ? form.start_time.slice(0, 10) : "";
  const endTimeOnly = form.end_time && typeof form.end_time === "string" ? form.end_time.slice(11, 16) : "";

  const visibleRooms =
    floorFilter === "all" ? availableRooms : availableRooms.filter((r) => (r.floor ?? 1) === Number(floorFilter));

  const selectedRoomIds = new Set((form.room_ids || []).map(String));

  const isValid =
    form.requester_name.trim() &&
    form.phone.trim() &&
    form.email.trim() &&
    form.start_time &&
    form.end_time &&
    typeof form.start_time === "string" &&
    typeof form.end_time === "string" &&
    form.end_time > form.start_time &&
    form.end_time.slice(0, 10) === form.start_time.slice(0, 10) &&
    form.purpose.trim() &&
    Number(form.attendees) >= 1 &&
    (form.room_ids || []).length > 0 &&
    !isPastTime(form.start_time) &&
    !isTooFarFuture(form.start_time);

  function handleSubmit(e) {
    e.preventDefault();
    if (isValid) {
      onSubmit(form);
    }
  }

  return (
    <Card sx={{ maxWidth: 640, mx: "auto" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: "#5d7186", mb: 2 }}>
          {guideText}
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label={t("fieldStartTime")}
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={form.start_time}
              onChange={handleStartTimeChange}
              inputProps={{ max: reservationMaxDateTime }}
            />

            {isTooFarFuture(form.start_time) && (
              <Alert severity="warning">현재 시간 기준 1개월 이후의 일정은 예약할 수 없습니다.</Alert>
            )}

            <Box>
              <Typography variant="caption" sx={{ color: "#5d7186", display: "block", mb: 0.75, fontSize: "12px", fontWeight: 500 }}>
                {t("fieldEndTime")} *
                {startDate && (
                  <Chip label={startDate} size="small" sx={{ ml: 1, height: 18, fontSize: "11px", bgcolor: "rgba(59,82,46,0.1)", color: "#3b522e", fontWeight: 600 }} />
                )}
              </Typography>
              <TextField
                type="time"
                size="small"
                fullWidth
                required
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

            <TextField select label={t("filterFloor")} fullWidth value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
              <MenuItem value="all">{t("filterAllFloors")}</MenuItem>
              {floors.map((floor) => (
                <MenuItem key={floor} value={String(floor)}>
                  {floor === 1 ? t("floor1Label") : t("floor2Label")}
                </MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="caption" sx={{ color: "#5d7186", display: "block", mb: 0.75, fontSize: "12px", fontWeight: 500 }}>
                {t("fieldRooms")} * ({selectedRoomIds.size} {t("selected")})
              </Typography>
              <Box sx={{ border: "1px solid #d8dfe7", borderRadius: "8px", p: 1.5, maxHeight: 280, overflowY: "auto" }}>
                {visibleRooms.length === 0 && (
                  <Typography variant="body2" sx={{ color: "#a0aab4" }}>
                    {t("noAvailableRooms")}
                  </Typography>
                )}
                <FormGroup>
                  {visibleRooms.map((room) => (
                    <FormControlLabel
                      key={room.id}
                      control={<Checkbox checked={selectedRoomIds.has(String(room.id))} onChange={() => toggleRoom(room.id)} />}
                      label={`${room.name} (${t("capacity")} ${room.capacity})`}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Box>

            <TextField label={t("purpose")} fullWidth required multiline rows={2} {...field("purpose")} />
            <TextField label={t("attendees")} type="number" fullWidth required inputProps={{ min: 1 }} {...field("attendees")} />
            <TextField label={t("notes")} fullWidth multiline rows={2} {...field("notes")} />

            <Stack direction="row" spacing={1.5} sx={{ width: "100%", justifyContent: "flex-end", pt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                sx={{
                  bgcolor: "#2f68f9",
                  fontSize: "14px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#1e50c7" },
                  "&:disabled": { bgcolor: "#d8dfe7", color: "#a0aab4" },
                }}
                disabled={!isValid}
              >
                {t("submitMultiRequest")}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
