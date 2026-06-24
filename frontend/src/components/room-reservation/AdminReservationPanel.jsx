import { useState, useEffect } from "react";
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
import ButtonGroup from "@mui/material/ButtonGroup";
import { formatDateTime, sortByStartTime } from "../../utils/datetime";
import { useLanguage } from "../../i18n/LanguageContext";
import { api } from "../../api";
import EventPublisher from "../../event/EventPublisher";
import { EventDef } from "../../event/EventDef";
import FloorPlanTooltip from "./FloorPlanTooltip";
import AdminReservationEditModal from "./AdminReservationEditModal";

const STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  changed: "info",
  rejected: "error",
};
const ITEMS_PER_PAGE = 20;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [localReservations, setLocalReservations] = useState(reservations || []);
  const [statusFilter, setStatusFilter] = useState("pending");

  const statusLabel = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    changed: t("statusChanged"),
    rejected: t("statusRejected"),
  };

  // Filter by selected status
  const filteredReservations = sortByStartTime(
    localReservations.filter(r => r.status === statusFilter)
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredReservations.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const displayedItems = filteredReservations.slice(startIdx, endIdx);

  // Auto-refresh pending reservations every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
      } catch (err) {
        console.error("[AdminReservationPanel] Failed to refresh reservations:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to reservation update events
  useEffect(() => {
    const handleReservationUpdated = async () => {
      try {
        const data = await api.getReservations();
        setLocalReservations(data);
        // Reset to first page when data updates
        setCurrentPage(1);
      } catch (err) {
        console.error("[AdminReservationPanel] Failed to refresh after update:", err);
      }
    };

    EventPublisher.addEventListener(EventDef.onReservationUpdated, "ADMIN_PANEL", handleReservationUpdated);
    return () => EventPublisher.removeEventListener(EventDef.onReservationUpdated, "ADMIN_PANEL", handleReservationUpdated);
  }, []);

  function handleEditClick(reservation) {
    setSelectedReservation(reservation);
    setEditModalOpen(true);
  }

  function handleCloseModal() {
    setEditModalOpen(false);
    setSelectedReservation(null);
  }

  function handlePageChange(newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: "#5d7186", mb: 2 }}>
          {displayGuideText}
        </Typography>

        {/* Status Filter + Pagination Info */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label={t("colStatus")}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when filter changes
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="pending">{t("statusPending")}</MenuItem>
            <MenuItem value="approved">{t("statusApproved")}</MenuItem>
            <MenuItem value="changed">{t("statusChanged")}</MenuItem>
            <MenuItem value="rejected">{t("statusRejected")}</MenuItem>
          </TextField>
          
          <Typography variant="caption" sx={{ color: "#8486a7", fontWeight: 600 }}>
            {filteredReservations.length > 0 
              ? `${startIdx + 1}–${Math.min(endIdx, filteredReservations.length)} of ${filteredReservations.length}`
              : "No reservations"
            }
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ButtonGroup size="small" variant="outlined">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                sx={{ fontSize: "12px", fontWeight: 600, color: "#1976d2", borderColor: "#d8dfe7" }}
              >
                {t("prev")}
              </Button>
              <Button
                disabled
                sx={{ fontSize: "12px", color: "#1976d2", borderColor: "#d8dfe7", cursor: "default" }}
              >
                {currentPage} / {totalPages || 1}
              </Button>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                sx={{ fontSize: "12px", fontWeight: 600, color: "#1976d2", borderColor: "#d8dfe7" }}
              >
                {t("next")}
              </Button>
            </ButtonGroup>
          </Stack>
        </Box>

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
              {displayedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 3, color: "#8486a7" }}>
                    <Typography variant="body2">{t("noReservationsVisible")}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayedItems.map((item) => (
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
                ))
              )}
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
