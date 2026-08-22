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

  // Calculate pagination (desktop only)
  const DESKTOP_ITEMS_PER_PAGE = ITEMS_PER_PAGE;
  const totalPages = Math.ceil(filteredReservations.length / DESKTOP_ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * DESKTOP_ITEMS_PER_PAGE;
  const endIdx = startIdx + DESKTOP_ITEMS_PER_PAGE;
  const displayedItems = filteredReservations.slice(startIdx, endIdx);
  
  // Mobile: show all items (no pagination)
  const mobileDisplayedItems = filteredReservations;

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

        {/* Status Filter + Pagination Info (Desktop Only) */}
        <Box sx={{ display: { xs: "none", md: "flex" }, justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label={t("colStatus")}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
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
                sx={{ fontSize: "12px", fontWeight: 600, color: "#3b522e", borderColor: "#d8dfe7" }}
              >
                {t("prev")}
              </Button>
              <Button
                disabled
                sx={{ fontSize: "12px", color: "#3b522e", borderColor: "#d8dfe7", cursor: "default" }}
              >
                {currentPage} / {totalPages || 1}
              </Button>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                sx={{ fontSize: "12px", fontWeight: 600, color: "#3b522e", borderColor: "#d8dfe7" }}
              >
                {t("next")}
              </Button>
            </ButtonGroup>
          </Stack>
        </Box>

        {/* Status Filter (Mobile Only) */}
        <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1 }}>
          <TextField
            select
            size="small"
            label={t("colStatus")}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            sx={{ minWidth: 120, flex: 1 }}
          >
            <MenuItem value="pending">{t("statusPending")}</MenuItem>
            <MenuItem value="approved">{t("statusApproved")}</MenuItem>
            <MenuItem value="changed">{t("statusChanged")}</MenuItem>
            <MenuItem value="rejected">{t("statusRejected")}</MenuItem>
          </TextField>
          
          <Typography variant="caption" sx={{ color: "#8486a7", fontWeight: 600, whiteSpace: "nowrap" }}>
            {filteredReservations.length}
          </Typography>
        </Box>

        {/* Desktop: Table View */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
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
                        <Typography sx={{ color: "#3b522e", fontWeight: 600 }}>
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
                          sx={{ color: "#3b522e", "&:hover": { bgcolor: "rgba(59, 82, 46, 0.1)" } }}
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
        </Box>

        {/* Mobile: Simple List View */}
        <Box sx={{ display: { xs: "block", md: "none" }, maxHeight: "600px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {mobileDisplayedItems.length === 0 ? (
            <Typography variant="body2" sx={{ textAlign: "center", py: 3, color: "#8486a7" }}>
              {t("noReservationsVisible")}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {mobileDisplayedItems.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => handleEditClick(item)}
                  sx={{
                    p: 2,
                    border: "1px solid #dde2ee",
                    borderRadius: "8px",
                    bgcolor: "#fafbfc",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "#eef2f7",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    },
                  }}
                >
                  <Stack spacing={1}>
                    {/* Room Name */}
                    <Typography sx={{ fontWeight: 700, color: "#3b522e", fontSize: "14px" }}>
                      <FloorPlanTooltip roomId={item.room_id} roomName={item.room_name}>
                        <span>{item.room_name}</span>
                      </FloorPlanTooltip>
                    </Typography>
                    
                    {/* Requester Name */}
                    <Typography sx={{ fontSize: "13px", color: "#5d7186" }}>
                      {item.requester_name}
                    </Typography>
                    
                    {/* Status Chip */}
                    <Chip
                      label={statusLabel[item.status] || item.status}
                      color={STATUS_COLOR[item.status] || "default"}
                      size="small"
                      sx={{ width: "fit-content" }}
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

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
