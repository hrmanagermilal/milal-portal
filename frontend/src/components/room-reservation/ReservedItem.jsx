import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import { formatDateTime, toHourText, dateToLocalISOString, localISOStringToUTCISO } from "../../utils/datetime";
import { statusLabel } from "../../constants";
import FloorPlanTooltip from "./FloorPlanTooltip";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";

const STATUS_COLORS = {
  pending:  { bg: "rgba(246,197,77,0.18)",  border: "#f6c54d", text: "#b07d00" },
  approved: { bg: "rgba(59,82,46,0.12)",   border: "#3b522e", text: "#155e2a" },
  changed:  { bg: "rgba(59,82,46,0.12)",  border: "#3b522e", text: "#0d47a1" },
  rejected: { bg: "rgba(249,92,92,0.12)",   border: "#f95c5c", text: "#b71c1c" },
};

export default function ReservedItem({ item, startHour, endHour, hourRange, placement, compact = false, currentUser = null, onUpdate = null, onDelete = null }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isOwner = currentUser && item.requester_name === currentUser.name;
  const canEdit = isOwner && (item.status === "pending" || item.status === "changed");
  const canDelete = isOwner;

  const openEditDialog = () => {
    setEditError("");
    setEditForm({
      purpose: item.purpose || "",
      attendees: String(item.attendees || 1),
      notes: item.notes || "",
      start_time: dateToLocalISOString(new Date(item.start_time)).slice(0, 16),
      end_time: dateToLocalISOString(new Date(item.end_time)).slice(0, 16),
    });
    setEditOpen(true);
  };

  const handleEditChange = (key) => (event) => {
    setEditForm((prev) => ({ ...(prev || {}), [key]: event.target.value }));
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setEditError("");
    setEditLoading(true);
    try {
      await api.updateReservation(item.id, {
        purpose: editForm.purpose.trim(),
        attendees: Number(editForm.attendees) || 1,
        notes: editForm.notes || "",
        start_time: localISOStringToUTCISO(editForm.start_time),
        end_time: localISOStringToUTCISO(editForm.end_time),
      });
      setEditOpen(false);
      setDetailOpen(false);
      EventPublisher.publish(EventDef.onReservationUpdated, { id: item.id, action: "user-update" });
      if (onUpdate) onUpdate(item.id);
    } catch (err) {
      setEditError(err.message || "Failed to update reservation");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await api.deleteReservation(item.id);
      setDeleteConfirmOpen(false);
      setDetailOpen(false);
      EventPublisher.publish(EventDef.onReservationUpdated, { id: item.id, action: "user-delete" });
      if (onDelete) onDelete(item.id);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete reservation");
    } finally {
      setDeleteLoading(false);
    }
  };
  
  let leftPercent, widthPercent;
  
  if (placement) {
    // Use provided placement (for week view)
    leftPercent = placement.left;
    widthPercent = placement.width;
  } else {
    // Calculate from hour range with minute precision (for day view)
    const gridStartMins = startHour * 60;
    const gridEndMins = endHour * 60;
    const totalMins = hourRange * 60;

    const startDate = new Date(item.start_time);
    const endDate = new Date(item.end_time);
    const itemStartMins = startDate.getHours() * 60 + startDate.getMinutes();
    const itemEndMins = endDate.getHours() * 60 + endDate.getMinutes();

    const clampedStart = Math.max(itemStartMins, gridStartMins);
    const clampedEnd = Math.min(itemEndMins, gridEndMins);
    const durationMins = Math.max(clampedEnd - clampedStart, 15);

    leftPercent = ((clampedStart - gridStartMins) / totalMins) * 100;
    widthPercent = (durationMins / totalMins) * 100;
  }

  const statusColor = STATUS_COLORS[item.status] || { bg: "#eee", border: "#999", text: "#333" };

  return (
    <>
      <Box
        onClick={() => setDetailOpen(true)}
        sx={{
          position: placement ? "static" : "absolute",
          top: !placement ? 0 : undefined,
          left: !placement ? `${leftPercent}%` : undefined,
          width: `${widthPercent}%`,
          height: placement ? "100%" : "100%",
          minHeight: placement ? undefined : compact ? "auto" : "50px",
          bgcolor: statusColor.bg,
          border: `${compact ? "1.5px" : "2px"} solid ${statusColor.border}`,
          borderRadius: "4px",
          padding: compact ? "2px 4px" : "4px 8px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: compact ? "center" : "center",
          alignItems: "flex-start",
          overflow: "hidden",
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: compact ? "none" : "0 2px 8px rgba(0,0,0,0.15)",
            transform: compact ? "none" : "translateY(-2px)",
          },
          zIndex: 10,
          ...(compact && { top: "5px", bottom: "5px" }),
        }}
        title={`${item.requester_name} | ${toHourText(new Date(item.start_time))} - ${toHourText(new Date(item.end_time))}`}
      >
        <Typography
          sx={{
            fontSize: compact ? "10px" : "11px",
            fontWeight: 700,
            color: statusColor.text,
            lineHeight: 1.2,
            wordBreak: "break-word",
            whiteSpace: compact ? "nowrap" : "normal",
            overflow: compact ? "hidden" : "visible",
            textOverflow: compact ? "ellipsis" : "clip",
          }}
        >
          {item.requester_name}
        </Typography>
        {!compact && (
          <Typography
            sx={{
              fontSize: "10px",
              color: statusColor.text,
              lineHeight: 1.2,
            }}
          >
            {toHourText(new Date(item.start_time))}
          </Typography>
        )}
      </Box>

      {/* Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { overflow: "visible" },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            pr: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #eef2f7",
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 4, height: 24, bgcolor: "#3b522e", borderRadius: "2px" }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e" }}>
              Reservation Detail
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={() => setDetailOpen(false)}
            sx={{ color: "#5d7186", "&:hover": { bgcolor: "#eef2f7" } }}
          >
            ✕
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {item && (
            <Box>
              <Box
                sx={{
                  bgcolor: "#f8f9fa",
                  px: 3,
                  py: 2,
                  borderBottom: "1px solid #eef2f7",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#5d7186",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontSize: "11px",
                    }}
                  >
                    Room
                  </Typography>
                  <FloorPlanTooltip roomId={item.room_id} roomName={item.room_name}>
                    <Typography
                      fontWeight={700}
                      sx={{ color: "#3b522e", fontSize: "16px" }}
                    >
                      {item.room_name}
                    </Typography>
                  </FloorPlanTooltip>
                </Box>

                <Chip
                  label={statusLabel[item.status] || item.status}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: "12px",
                    px: 0.5,
                    bgcolor: statusColor.bg,
                    color: statusColor.text,
                  }}
                />
              </Box>
              <Stack sx={{ px: 3, py: 2 }} spacing={2}>
                <Box sx={{ bgcolor: "#f0f4ff", borderRadius: "8px", p: 1.5 }}>
                  <Stack direction="row" spacing={3}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#5d7186",
                          textTransform: "uppercase",
                          fontSize: "10px",
                        }}
                      >
                        Start
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: "#313b5e" }}
                      >
                        {formatDateTime(item.start_time)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        color: "#5d7186",
                      }}
                    >
                      →
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#5d7186",
                          textTransform: "uppercase",
                          fontSize: "10px",
                        }}
                      >
                        End
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: "#313b5e" }}
                      >
                        {formatDateTime(item.end_time)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#5d7186",
                      textTransform: "uppercase",
                      fontSize: "10px",
                      mb: 0.5,
                      display: "block",
                    }}
                  >
                    Requester
                  </Typography>
                  <Box
                    sx={{
                      border: "1px solid #eef2f7",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { label: "Name", value: item.requester_name },
                      { label: "Phone", value: item.phone },
                      { label: "Email", value: item.email },
                      { label: "Attendees", value: item.attendees },
                    ].map(({ label, value }, i) => (
                      <Stack
                        key={label}
                        direction="row"
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          bgcolor: i % 2 === 0 ? "white" : "#fafbfc",
                          borderBottom: i < 3 ? "1px solid #eef2f7" : "none",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: "#5d7186", width: 80, flexShrink: 0 }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ color: "#313b5e" }}
                        >
                          {value}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                </Box>
                {item.purpose && (
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#5d7186",
                        textTransform: "uppercase",
                        fontSize: "10px",
                        mb: 0.5,
                        display: "block",
                      }}
                    >
                      Purpose
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        bgcolor: "#f8f9fa",
                        border: "1px solid #eef2f7",
                        p: 1.5,
                        borderRadius: "8px",
                        color: "#313b5e",
                      }}
                    >
                      {item.purpose}
                    </Typography>
                  </Box>
                )}
                {item.notes && (
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#5d7186",
                        textTransform: "uppercase",
                        fontSize: "10px",
                        mb: 0.5,
                        display: "block",
                      }}
                    >
                      Notes
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        bgcolor: "#f8f9fa",
                        border: "1px solid #eef2f7",
                        p: 1.5,
                        borderRadius: "8px",
                        color: "#313b5e",
                      }}
                    >
                      {item.notes}
                    </Typography>
                  </Box>
                )}
                {item.admin_comment && (
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#5d7186",
                        textTransform: "uppercase",
                        fontSize: "10px",
                        mb: 0.5,
                        display: "block",
                      }}
                    >
                      Admin Comment
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        bgcolor: "#fff8e1",
                        border: "1px solid #ffe082",
                        p: 1.5,
                        borderRadius: "8px",
                        color: "#7a5800",
                      }}
                    >
                      {item.admin_comment}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        
        {/* Action Buttons */}
        {isOwner && (
          <Box sx={{ px: 3, py: 2, borderTop: "1px solid #eef2f7", bgcolor: "#fafbfc" }}>
            <Stack direction="row" spacing={1}>
              {canEdit && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setDetailOpen(false);
                    openEditDialog();
                  }}
                  sx={{ textTransform: "none", flex: 1, borderColor: "#3b522e", color: "#3b522e" }}
                >
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleDeleteClick}
                  sx={{ textTransform: "none", flex: 1, borderColor: "#f95c5c", color: "#f95c5c" }}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => !editLoading && setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e" }}>
            Edit Reservation
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Purpose" fullWidth value={editForm?.purpose || ""} onChange={handleEditChange("purpose")} />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Start Time"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editForm?.start_time || ""}
                onChange={handleEditChange("start_time")}
              />
              <TextField
                label="End Time"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={editForm?.end_time || ""}
                onChange={handleEditChange("end_time")}
              />
            </Stack>
            <TextField label="Attendees" type="number" inputProps={{ min: 1 }} fullWidth value={editForm?.attendees || "1"} onChange={handleEditChange("attendees")} />
            <TextField label="Notes" fullWidth multiline minRows={2} value={editForm?.notes || ""} onChange={handleEditChange("notes")} />
            {editError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {editError}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button variant="outlined" size="small" onClick={() => setEditOpen(false)} disabled={editLoading} sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button variant="contained" size="small" onClick={handleSaveEdit} disabled={editLoading} sx={{ bgcolor: "#3b522e", textTransform: "none", "&:hover": { bgcolor: "#2f4325" } }}>
                {editLoading ? <CircularProgress size={18} color="inherit" /> : "Save"}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleteLoading && setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e" }}>
            Delete Reservation?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: "#5d7186" }}>
              Are you sure you want to delete this reservation? This action cannot be undone.
            </Typography>
            {deleteError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {deleteError}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteLoading}
                sx={{ textTransform: "none" }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                sx={{ bgcolor: "#f95c5c", textTransform: "none", "&:hover": { bgcolor: "#d32f2f" } }}
              >
                {deleteLoading ? <CircularProgress size={18} color="inherit" /> : "Delete"}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
