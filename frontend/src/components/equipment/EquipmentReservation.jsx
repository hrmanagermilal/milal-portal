import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { api } from "../../api";
import { useLanguage } from "../../lang/LanguageContext";

const today = () => new Date().toISOString().slice(0, 10);
const statusTranslationKey = { pending: "equipmentStatusPending", approved: "equipmentStatusApproved", changed: "equipmentStatusChanged", rejected: "equipmentStatusRejected" };
const statusColor = { pending: "warning", approved: "success", changed: "info", rejected: "default" };

function translate(t, key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
    t(key),
  );
}

function EquipmentImage({ item, size = 64 }) {
  return item.image_url ? (
    <Box component="img" src={item.image_url} alt={item.name} sx={{ width: size, height: size, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} />
  ) : (
    <Avatar variant="rounded" sx={{ width: size, height: size, bgcolor: "#e8edf2", color: "#5d7186" }}>
      <Inventory2OutlinedIcon />
    </Avatar>
  );
}

function Feedback({ error, success }) {
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
    </>
  );
}

export function EquipmentStatus() {
  const { t } = useLanguage();
  const [equipment, setEquipment] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getEquipment(), api.getEquipmentReservations()])
      .then(([items, bookings]) => {
        setEquipment(items);
        setSelectedId(items[0]?.id || null);
        setReservations(bookings);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = equipment.find((item) => item.id === selectedId);
  const visible = reservations.filter((item) => item.equipment_id === selectedId);

  if (loading) return <CircularProgress size={24} />;
  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" fontWeight={800}>{t("equipmentStatusTitle")}</Typography>
      <Feedback error={error} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: "#f4f7fa" }}><Typography fontWeight={700}>{t("equipmentList")}</Typography></Box>
            <List disablePadding>
              {equipment.map((item) => (
                <ListItemButton key={item.id} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ gap: 1.5, py: 1.25 }}>
                  <EquipmentImage item={item} size={48} />
                  <ListItemText primary={item.name} secondary={translate(t, "equipmentTotalAndLocation", { count: item.total_quantity, location: item.storage_location || t("equipmentStorageUnspecified") })} />
                </ListItemButton>
              ))}
              {!equipment.length && <Box sx={{ p: 3 }}><Typography color="text.secondary">{t("equipmentNoneRegistered")}</Typography></Box>}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={1.25}>
            <Typography variant="h6" fontWeight={750}>{selected ? translate(t, "equipmentReservationsFor", { name: selected.name }) : t("equipmentSelectPrompt")}</Typography>
            {visible.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography fontWeight={700}>{translate(t, "equipmentRequesterQuantity", { name: item.requester_name, count: item.quantity })}</Typography>
                    <Typography color="text.secondary" variant="body2">{item.start_date} ~ {item.end_date}</Typography>
                    <Typography sx={{ mt: 0.75 }}>{item.purpose}</Typography>
                  </Box>
                  <Chip
                    label={item.returned_at ? t("equipmentStatusReturned") : (statusTranslationKey[item.status] ? t(statusTranslationKey[item.status]) : item.status)}
                    color={item.returned_at ? "default" : statusColor[item.status]}
                    size="small"
                  />
                </Stack>
              </Paper>
            ))}
            {selected && !visible.length && <Alert severity="info">{t("equipmentNoUpcomingReservations")}</Alert>}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

export function EquipmentRequest() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ equipment_id: "", start_date: today(), end_date: today(), quantity: 1, purpose: "" });
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) return;
    setLoading(true);
    api.getEquipment(form.start_date, form.end_date)
      .then((items) => {
        setEquipment(items);
        if (!items.some((item) => String(item.id) === String(form.equipment_id))) {
          setForm((current) => ({ ...current, equipment_id: "", quantity: 1 }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [form.start_date, form.end_date]);

  const selected = equipment.find((item) => String(item.id) === String(form.equipment_id));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.createEquipmentReservation({ ...form, equipment_id: Number(form.equipment_id), quantity: Number(form.quantity) });
      const refreshedEquipment = await api.getEquipment(form.start_date, form.end_date);
      setEquipment(refreshedEquipment);
      setSuccess(t("equipmentRequestSubmitted"));
      setForm((current) => ({ ...current, equipment_id: "", quantity: 1, purpose: "" }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2.5}>
        <Typography variant="h5" fontWeight={800}>{t("equipmentRequestTitle")}</Typography>
        <Feedback error={error} success={success} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label={t("equipmentStartDate")} type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }} fullWidth />
          <TextField label={t("equipmentEndDate")} type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: form.start_date } }} fullWidth />
        </Stack>
        {loading ? <CircularProgress size={24} /> : (
          <Grid container spacing={1.5}>
            {equipment.map((item) => {
              const selectedItem = String(item.id) === String(form.equipment_id);
              return (
                <Grid key={item.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Paper
                    component="button"
                    type="button"
                    onClick={() => item.available_quantity > 0 && setForm({ ...form, equipment_id: item.id, quantity: 1 })}
                    variant="outlined"
                    sx={{ width: "100%", p: 1.5, display: "flex", gap: 1.5, textAlign: "left", borderColor: selectedItem ? "#3b522e" : "#d8dfe7", bgcolor: selectedItem ? "rgba(59,82,46,0.06)" : "white", cursor: item.available_quantity ? "pointer" : "not-allowed", opacity: item.available_quantity ? 1 : 0.55 }}
                  >
                    <EquipmentImage item={item} size={72} />
                    <Box>
                      <Typography fontWeight={750}>{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{translate(t, "equipmentTotalQuantity", { count: item.total_quantity })}</Typography>
                      <Typography variant="body2" color={item.available_quantity ? "success.main" : "error.main"}>{translate(t, "equipmentAvailableQuantity", { count: item.available_quantity })}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
        {selected && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography fontWeight={750}>{translate(t, "equipmentRequestInfo", { name: selected.name })}</Typography>
              <TextField label={t("equipmentQuantity")} type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} slotProps={{ htmlInput: { min: 1, max: selected.available_quantity } }} helperText={translate(t, "equipmentMaxQuantity", { count: selected.available_quantity })} required />
              <TextField label={t("equipmentPurpose")} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} multiline minRows={2} required />
              <Button type="submit" variant="contained" disabled={!form.purpose.trim() || Number(form.quantity) < 1 || Number(form.quantity) > selected.available_quantity}>{t("equipmentSubmitRequest")}</Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export function EquipmentAdminReview() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [returnItems, setReturnItems] = useState([]);
  const [approvedItems, setApprovedItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [comments, setComments] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = () => Promise.all([
    api.getEquipmentReservations(null, true),
    api.getEquipmentReservations(null, false, true),
    api.getEquipmentReservations(null, false, false, true),
    api.adminGetEquipment(),
  ])
    .then(([approvalItems, pendingReturns, approvedReservations, equipmentItems]) => {
      setItems(approvalItems);
      setReturnItems(pendingReturns);
      setApprovedItems(approvedReservations);
      setEquipment(equipmentItems);
    })
    .catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  const review = async (id, action) => {
    setError("");
    setSuccess("");
    try {
      await api.reviewEquipmentReservation(id, { action, admin_comment: comments[id] || "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmReturn = async (id) => {
    setError("");
    setSuccess("");
    try {
      await api.confirmEquipmentReturn(id);
      setSuccess(t("equipmentReturnConfirmed"));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditForm({
      equipment_id: item.equipment_id,
      quantity: item.quantity,
      start_date: item.start_date,
      end_date: item.end_date,
      purpose: item.purpose,
      admin_comment: item.admin_comment || "",
    });
  };

  const saveApprovedReservation = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.updateApprovedEquipmentReservation(editId, {
        ...editForm,
        equipment_id: Number(editForm.equipment_id),
        quantity: Number(editForm.quantity),
      });
      setSuccess(t("equipmentReservationUpdated"));
      setEditId(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>{t("equipmentReviewTitle")}</Typography>
      <Feedback error={error} success={success} />
      <Typography variant="h6" fontWeight={750}>{t("equipmentApprovalRequests")}</Typography>
      {items.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
              <Box>
                <Typography fontWeight={750}>{translate(t, "equipmentRequesterQuantity", { name: item.equipment_name, count: item.quantity })}</Typography>
                <Typography variant="body2" color="text.secondary">{item.requester_name} · {item.start_date} ~ {item.end_date}</Typography>
                <Typography sx={{ mt: 0.5 }}>{item.purpose}</Typography>
              </Box>
              <Chip label={t("equipmentStatusPending")} color="warning" size="small" />
            </Stack>
            <TextField label={t("equipmentAdminComment")} value={comments[item.id] || ""} onChange={(event) => setComments({ ...comments, [item.id]: event.target.value })} size="small" />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button color="error" variant="outlined" startIcon={<CloseOutlinedIcon />} onClick={() => review(item.id, "reject")}>{t("equipmentReject")}</Button>
              <Button color="success" variant="contained" startIcon={<CheckOutlinedIcon />} onClick={() => review(item.id, "approve")}>{t("equipmentApprove")}</Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {!items.length && !error && <Alert severity="info">{t("equipmentNoReviewRequests")}</Alert>}
      <Divider />
      <Typography variant="h6" fontWeight={750}>{t("equipmentApprovedReservations")}</Typography>
      {approvedItems.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          {editId === item.id && editForm ? (
            <Box component="form" onSubmit={saveApprovedReservation}>
              <Stack spacing={1.5}>
                <Typography fontWeight={750}>{t("equipmentEditReservationTitle")}</Typography>
                <TextField select label={t("equipmentSelectItem")} value={editForm.equipment_id} onChange={(event) => setEditForm({ ...editForm, equipment_id: event.target.value })} required>
                  {equipment.map((equipmentItem) => <MenuItem key={equipmentItem.id} value={equipmentItem.id}>{equipmentItem.name}</MenuItem>)}
                </TextField>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField label={t("equipmentStartDate")} type="date" value={editForm.start_date} onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
                  <TextField label={t("equipmentEndDate")} type="date" value={editForm.end_date} onChange={(event) => setEditForm({ ...editForm, end_date: event.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: editForm.start_date } }} fullWidth required />
                  <TextField label={t("equipmentQuantity")} type="number" value={editForm.quantity} onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })} slotProps={{ htmlInput: { min: 1 } }} fullWidth required />
                </Stack>
                <TextField label={t("equipmentPurpose")} value={editForm.purpose} onChange={(event) => setEditForm({ ...editForm, purpose: event.target.value })} multiline minRows={2} required />
                <TextField label={t("equipmentAdminMemo")} value={editForm.admin_comment} onChange={(event) => setEditForm({ ...editForm, admin_comment: event.target.value })} multiline minRows={2} />
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={() => { setEditId(null); setEditForm(null); }}>{t("equipmentCancelEdit")}</Button>
                  <Button type="submit" variant="contained" disabled={editForm.end_date < editForm.start_date || Number(editForm.quantity) < 1 || !editForm.purpose.trim()}>{t("equipmentSaveChanges")}</Button>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}>
              <Box>
                <Typography fontWeight={750}>{translate(t, "equipmentRequesterQuantity", { name: item.equipment_name, count: item.quantity })}</Typography>
                <Typography variant="body2" color="text.secondary">{item.requester_name} · {item.start_date} ~ {item.end_date}</Typography>
                <Typography sx={{ mt: 0.5 }}>{item.purpose}</Typography>
              </Box>
              <Button variant="outlined" onClick={() => startEdit(item)}>{t("equipmentEditReservation")}</Button>
            </Stack>
          )}
        </Paper>
      ))}
      {!approvedItems.length && !error && <Alert severity="info">{t("equipmentNoApprovedReservations")}</Alert>}
      <Divider />
      <Typography variant="h6" fontWeight={750}>{t("equipmentReturnPending")}</Typography>
      {returnItems.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}>
            <Box>
              <Typography fontWeight={750}>{translate(t, "equipmentRequesterQuantity", { name: item.equipment_name, count: item.quantity })}</Typography>
              <Typography variant="body2" color="text.secondary">{item.requester_name} · {item.start_date} ~ {item.end_date}</Typography>
              <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>{translate(t, "equipmentReturnDue", { date: item.end_date })}</Typography>
              <Typography sx={{ mt: 0.5 }}>{item.purpose}</Typography>
            </Box>
            <Button variant="contained" color="success" startIcon={<CheckOutlinedIcon />} onClick={() => confirmReturn(item.id)}>
              {t("equipmentConfirmReturn")}
            </Button>
          </Stack>
        </Paper>
      ))}
      {!returnItems.length && !error && <Alert severity="info">{t("equipmentNoPendingReturns")}</Alert>}
    </Stack>
  );
}

const emptyItem = { name: "", storage_location: "", total_quantity: 1, image_data_url: "", is_active: true };

export function EquipmentSettings() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = () => api.adminGetEquipment().then(setItems).catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  const choose = (item) => {
    setSelectedId(item.id);
    setForm({ name: item.name, storage_location: item.storage_location, total_quantity: item.total_quantity, image_data_url: "", is_active: item.is_active });
  };
  const readImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, image_data_url: reader.result }));
    reader.readAsDataURL(file);
  };
  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = { ...form, total_quantity: Number(form.total_quantity) };
      if (selectedId) await api.adminUpdateEquipment(selectedId, payload);
      else await api.adminCreateEquipment(payload);
      setSuccess(selectedId ? t("equipmentUpdated") : t("equipmentCreated"));
      setSelectedId(null);
      setForm(emptyItem);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" fontWeight={800}>{t("equipmentSettingsTitle")}</Typography>
      <Feedback error={error} success={success} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: "#f4f7fa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography fontWeight={700}>{t("equipmentRegisteredItems")}</Typography>
              <Button size="small" onClick={() => { setSelectedId(null); setForm(emptyItem); }}>{t("equipmentNewItem")}</Button>
            </Box>
            <List disablePadding>
              {items.map((item) => (
                <ListItemButton key={item.id} selected={item.id === selectedId} onClick={() => choose(item)} sx={{ gap: 1.5 }}>
                  <EquipmentImage item={item} size={48} />
                  <ListItemText primary={item.name} secondary={translate(t, "equipmentLocationAndQuantity", { location: item.storage_location || t("equipmentLocationUnspecified"), count: item.total_quantity, inactive: item.is_active ? "" : t("equipmentInactiveSuffix") })} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Box component="form" onSubmit={save}>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={750}>{selectedId ? t("equipmentEditTitle") : t("equipmentCreateTitle")}</Typography>
              <TextField label={t("equipmentName")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <TextField label={t("equipmentStorageLocation")} value={form.storage_location} onChange={(event) => setForm({ ...form, storage_location: event.target.value })} />
              <TextField label={t("equipmentTotalQuantityLabel")} type="number" value={form.total_quantity} onChange={(event) => setForm({ ...form, total_quantity: event.target.value })} slotProps={{ htmlInput: { min: 1 } }} required />
              <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />}>
                {t("equipmentSelectPhoto")}
                <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => readImage(event.target.files?.[0])} />
              </Button>
              {form.image_data_url && <Box component="img" src={form.image_data_url} alt={t("equipmentSelectedPhotoAlt")} sx={{ width: 160, height: 120, objectFit: "cover", borderRadius: 1 }} />}
              <FormControlLabel control={<Switch checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />} label={t("equipmentAvailableStatus")} />
              <Divider />
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />}>{selectedId ? t("equipmentSaveChanges") : t("equipmentRegister")}</Button>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}