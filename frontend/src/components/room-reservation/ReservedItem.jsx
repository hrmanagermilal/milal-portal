import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { formatDateTime, toHourText } from "../../utils/datetime";
import { statusLabel } from "../../constants";
import FloorPlanTooltip from "./FloorPlanTooltip";

const STATUS_COLORS = {
  pending:  { bg: "rgba(246,197,77,0.18)",  border: "#f6c54d", text: "#b07d00" },
  approved: { bg: "rgba(34,185,86,0.12)",   border: "#22b956", text: "#155e2a" },
  changed:  { bg: "rgba(25,118,210,0.12)",  border: "#1976d2", text: "#0d47a1" },
  rejected: { bg: "rgba(249,92,92,0.12)",   border: "#f95c5c", text: "#b71c1c" },
};

export default function ReservedItem({ item, startHour, endHour, hourRange, placement, compact = false }) {
  const [detailOpen, setDetailOpen] = useState(false);

  // Calculate position and width based on hour range (if placement not provided)
  let leftPercent, widthPercent;
  
  if (placement) {
    // Use provided placement (for week view)
    leftPercent = placement.left;
    widthPercent = placement.width;
  } else {
    // Calculate from hour range (for day view)
    // startHour/endHour = 6~22 (total 16 hours)
    // item.start_time = when reservation starts (e.g., 10:00)
    // item.end_time = when reservation ends (e.g., 12:00)

    const itemStartHour = new Date(item.start_time).getHours();
    const itemEndHour = new Date(item.end_time).getHours();
    
    // Calculate position from left (as percentage of total hour range)
    leftPercent = ((itemStartHour - startHour) / hourRange) * 100;
    
    // Calculate width (as percentage of total hour range)
    widthPercent = ((itemEndHour - itemStartHour) / hourRange) * 100;
  }

  const statusColor = STATUS_COLORS[item.status] || { bg: "#eee", border: "#999", text: "#333" };

  return (
    <>
      <Box
        onClick={() => setDetailOpen(true)}
        sx={{
          position: placement ? "static" : "absolute",
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
            <Box sx={{ width: 4, height: 24, bgcolor: "#1976d2", borderRadius: "2px" }} />
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
                      sx={{ color: "#1976d2", fontSize: "16px" }}
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
      </Dialog>
    </>
  );
}
