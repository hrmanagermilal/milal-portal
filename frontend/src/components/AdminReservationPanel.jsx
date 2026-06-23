import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import { formatDateTime, sortByStartTime } from "../utils/datetime";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  changed: "info",
  rejected: "error",
};

export default function AdminReservationPanel({
  rooms,
  reservations,
  adminKey,
  setAdminKey,
  adminComment,
  setAdminComment,
  adminRoomId,
  setAdminRoomId,
  adminStartTime,
  setAdminStartTime,
  adminEndTime,
  setAdminEndTime,
  onAdminAction,
}) {
  const { t } = useLanguage();

  const statusLabel = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    changed: t("statusChanged"),
    rejected: t("statusRejected"),
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t("adminReview")}
        </Typography>

        <TextField
          label={t("adminApiKey")}
          type="password"
          size="small"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder={t("adminApiKeyPlaceholder")}
          sx={{ mb: 3, width: 340 }}
        />

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: "#eef2f7" }}>
              <TableRow>
                {["ID", t("colRoom"), t("colWhen"), t("colRequester"), t("colStatus"), t("colChangeTo"), t("colAdminNote"), t("colActions")].map((h) => (
                  <TableCell key={h} sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortByStartTime(reservations).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>
                    <Typography sx={{ color: "#1976d2", fontWeight: 600 }}>
                      {item.room_name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(item.start_time)}<br />
                    {formatDateTime(item.end_time)}
                  </TableCell>
                  <TableCell>
                    {item.requester_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {item.phone} / {item.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabel[item.status] || item.status}
                      color={STATUS_COLOR[item.status] || "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    <Stack spacing={1}>
                      <TextField select size="small" label={t("changeRoom")}
                        value={adminRoomId[item.id] ?? item.room_id}
                        onChange={(e) => setAdminRoomId((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        fullWidth
                      >
                        {rooms.map((room) => (
                          <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
                        ))}
                      </TextField>
                      <TextField type="datetime-local" size="small" label={t("changeStartTime")}
                        InputLabelProps={{ shrink: true }}
                        value={adminStartTime[item.id] ?? item.start_time.slice(0, 16)}
                        onChange={(e) => setAdminStartTime((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        fullWidth
                      />
                      <TextField type="datetime-local" size="small" label={t("changeEndTime")}
                        InputLabelProps={{ shrink: true }}
                        value={adminEndTime[item.id] ?? item.end_time.slice(0, 16)}
                        onChange={(e) => setAdminEndTime((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        fullWidth
                      />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <TextField multiline rows={3} size="small" fullWidth
                      value={adminComment[item.id] ?? ""}
                      onChange={(e) => setAdminComment((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    <Stack spacing={0.5} direction="row">
                      <Button variant="contained" size="small"
                        sx={{ bgcolor: "#22b956", color: "white", fontWeight: 600, fontSize: "12px", flex: 1, "&:hover": { bgcolor: "#1a8a42" } }}
                        onClick={() => onAdminAction(item.id, "approve")}
                      >{t("actionApprove")}</Button>
                      <Button variant="contained" size="small"
                        sx={{ bgcolor: "#1976d2", color: "white", fontWeight: 600, fontSize: "12px", flex: 1, "&:hover": { bgcolor: "#1565c0" } }}
                        onClick={() => onAdminAction(item.id, "change")}
                      >{t("actionChange")}</Button>
                      <Button variant="contained" size="small"
                        sx={{ bgcolor: "#f95c5c", color: "white", fontWeight: 600, fontSize: "12px", flex: 1, "&:hover": { bgcolor: "#e64545" } }}
                        onClick={() => onAdminAction(item.id, "reject")}
                      >{t("actionReject")}</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
