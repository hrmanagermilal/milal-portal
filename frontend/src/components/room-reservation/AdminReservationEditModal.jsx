import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useLanguage } from "../../i18n/LanguageContext";

export default function AdminReservationEditModal({
  open,
  onClose,
  reservation,
  rooms,
  onSave,
}) {
  const { t } = useLanguage();
  
  // 예약 정보
  const [roomId, setRoomId] = useState(reservation?.room_id || "");
  const [startTime, setStartTime] = useState(reservation?.start_time.slice(0, 16) || "");
  const [endTime, setEndTime] = useState(reservation?.end_time.slice(0, 16) || "");
  const [purpose, setPurpose] = useState(reservation?.purpose || "");
  const [attendees, setAttendees] = useState(reservation?.attendees || 1);
  const [notes, setNotes] = useState(reservation?.notes || "");
  
  // 관리자 정보
  const [adminComment, setAdminComment] = useState("");
  const [adminStatus, setAdminStatus] = useState("pending");

  function handleSave() {
    // Map adminStatus to action
    const statusToAction = {
      pending: null,
      approved: "approve",
      changed: "change",
      rejected: "reject"
    };
    
    const action = statusToAction[adminStatus];
    
    // 변경사항 저장
    if (onSave && action) {
      onSave(reservation.id, action, {
        room_id: roomId,
        start_time: startTime,
        end_time: endTime,
        purpose,
        attendees,
        notes,
        admin_comment: adminComment,
      });
    }
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {t("adminEditTitle")} (ID: {reservation?.id})
      </DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Box component="form">
          <Stack spacing={2.2}>
            {/* 신청자 정보 (읽기전용) */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#313b5e", mb: 1.5 }}>
                {t("requesterInfo")}
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  label={t("fieldName")}
                  fullWidth
                  size="small"
                  value={reservation?.requester_name || ""}
                  disabled
                />
                <TextField
                  label={t("fieldPhone")}
                  fullWidth
                  size="small"
                  value={reservation?.phone || ""}
                  disabled
                />
                <TextField
                  label={t("fieldEmail")}
                  fullWidth
                  size="small"
                  value={reservation?.email || ""}
                  disabled
                />
              </Stack>
            </Box>

            <Divider />

            {/* 예약 정보 (편집가능) */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#313b5e", mb: 1.5 }}>
                {t("reservationInfo")}
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  select
                  label={t("fieldRoom")}
                  fullWidth
                  size="small"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  {rooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      {room.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t("fieldStartTime")}
                  type="datetime-local"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <TextField
                  label={t("fieldEndTime")}
                  type="datetime-local"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <TextField
                  label={t("purpose")}
                  fullWidth
                  size="small"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
                <TextField
                  label={t("attendees")}
                  type="number"
                  fullWidth
                  size="small"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                />
                <TextField
                  label={t("notes")}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Stack>
            </Box>

            <Divider />

            {/* 관리자 정보 */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#313b5e", mb: 1.5 }}>
                {t("adminHandling")}
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  select
                  label={t("approvalStatus")}
                  fullWidth
                  size="small"
                  value={adminStatus}
                  onChange={(e) => setAdminStatus(e.target.value)}
                >
                  <MenuItem value="pending">{t("statusWaiting")}</MenuItem>
                  <MenuItem value="approved">{t("statusApproved")}</MenuItem>
                  <MenuItem value="changed">{t("statusModified")}</MenuItem>
                  <MenuItem value="rejected">{t("statusDeclined")}</MenuItem>
                </TextField>
                <TextField
                  label={t("adminNoteLabel")}
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder={t("adminNotePlaceholder")}
                />
              </Stack>
            </Box>

            {/* 버튼 */}
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pt: 1 }}>
              <Button
                variant="outlined"
                onClick={onClose}
                sx={{
                  color: "#5d7186",
                  borderColor: "#d8dfe7",
                  fontSize: "14px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#9aa4b1",
                    bgcolor: "rgba(93,113,134,0.04)",
                  },
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                sx={{
                  bgcolor: "#2f68f9",
                  fontSize: "14px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#1e50c7" },
                }}
              >
                {t("saveBtnLabel")}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
