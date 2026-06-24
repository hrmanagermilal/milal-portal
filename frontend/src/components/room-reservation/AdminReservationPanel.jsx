import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
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
import { formatDateTime, sortByStartTime } from "../../utils/datetime";
import { useLanguage } from "../../i18n/LanguageContext";
import FloorPlanTooltip from "./FloorPlanTooltip";
import AdminReservationEditModal from "./AdminReservationEditModal";

const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  changed: "info",
  rejected: "error",
};

export default function AdminReservationPanel({
  rooms,
  reservations,
  onAdminAction,
  guideText,
}) {
  const { t } = useLanguage();
  const displayGuideText = guideText || t("adminGuideText");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  const statusLabel = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    changed: t("statusChanged"),
    rejected: t("statusRejected"),
  };

  function handleEditClick(reservation) {
    setSelectedReservation(reservation);
    setEditModalOpen(true);
  }

  function handleCloseModal() {
    setEditModalOpen(false);
    setSelectedReservation(null);
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: "#5d7186", mb: 2 }}>
          {displayGuideText}
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: "#eef2f7" }}>
              <TableRow>
                {[t("colRoom"), t("colWhen"), t("colRequester"), t("colStatus"), ""].map((h) => (
                  <TableCell key={h} sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortByStartTime(reservations).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography sx={{ color: "#1976d2", fontWeight: 600 }}>
                      <FloorPlanTooltip roomId={item.room_id} roomName={item.room_name}>
                        <span>{item.room_name}</span>
                      </FloorPlanTooltip>
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(item.start_time)}<br />
                    {formatDateTime(item.end_time)}
                  </TableCell>
                  <TableCell>
                    {item.requester_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {item.phone}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabel[item.status] || item.status}
                      color={STATUS_COLOR[item.status] || "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(item)}
                      sx={{ color: "#1976d2", "&:hover": { bgcolor: "rgba(25, 118, 210, 0.1)" } }}
                      title={t("edit")}
                    >
                      ✎
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {selectedReservation && (
          <AdminReservationEditModal
            open={editModalOpen}
            onClose={handleCloseModal}
            reservation={selectedReservation}
            rooms={rooms}
            onSave={onAdminAction}
          />
        )}
      </CardContent>
    </Card>
  );
}
