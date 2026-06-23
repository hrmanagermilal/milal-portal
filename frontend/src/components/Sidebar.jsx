import { useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";

// Icons - you can enhance this with real icons from @mui/icons-material
const MenuIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PlusIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SettingsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6m-16.78 7.78l4.24-4.24m2.12-2.12l4.24-4.24" />
  </svg>
);

const RefreshIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
  </svg>
);

const CalendarIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronDownIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const navItems = [
  { key: "timeline", label: "Reservation Status", icon: MenuIcon, badge: null },
  { key: "request", label: "New Request", icon: PlusIcon, badge: null },
  { key: "admin", label: "Admin Review", icon: CheckIcon, badge: null },
  { key: "space-settings", label: "Room Settings", icon: SettingsIcon, badge: null },
];

export default function Sidebar({ activeTab, onTabChange, onRefresh, pendingCount = 0 }) {
  const [menuOpen, setMenuOpen] = useState(true);

  return (
    <Box
      component="nav"
      sx={{
        width: 250,
        flexShrink: 0,
        bgcolor: "#eef2f7",  // Light Grey (Velok light background)
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* Sidebar Header - Velok Branding */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Velok Logo */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: "#d6dbd8",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: 800,
                color: "white",
              }}
            >
              M
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: "16px",
                  color: "#313b5e",  // Dark text
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}
              >
                Milal
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "#5d7186",  // Medium gray text
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  marginTop: "2px",
                }}
              >
                Rooms
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ bgcolor: "rgba(0, 0, 0, 0.08)" }} />

      {/* Navigation Tree */}
      <Stack sx={{ p: 1.5, pb: 2 }}>
        {/* Root: Milal Portal */}
        <Button
          onClick={() => setMenuOpen((prev) => !prev)}
          startIcon={CalendarIcon}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 700,
            color: "#313b5e",
            borderRadius: "8px",
            px: 1.5,
            py: 1.1,
            transition: "all 0.2s ease",
            "&:hover": { bgcolor: "#e8ecf2" },
          }}
        >
          <Box sx={{ flexGrow: 1, textAlign: "left" }}>Room Reservation</Box>
          <Box sx={{
            transform: menuOpen ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
          }}>
            {ChevronDownIcon}
          </Box>
        </Button>

        {/* Sub-items */}
        <Collapse in={menuOpen}>
          <Stack spacing={0.25} sx={{ pl: 1.5, mt: 0.25 }}>
            {/* Left tree line */}
            <Box sx={{ position: "relative" }}>
              <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 8, width: "1.5px", bgcolor: "#d8dfe7" }} />
              <Stack spacing={0.25}>
                {navItems.map((item) => (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    <Button
                      onClick={() => onTabChange(item.key)}
                      startIcon={item.icon}
                      sx={{
                        justifyContent: "flex-start",
                        color: activeTab === item.key ? "#1976d2" : "#5d7186",
                        textTransform: "none",
                        fontSize: "13px",
                        fontWeight: activeTab === item.key ? 700 : 500,
                        bgcolor: activeTab === item.key ? "rgba(25, 118, 210, 0.08)" : "transparent",
                        borderRadius: "8px",
                        pl: 2,
                        pr: 1.5,
                        py: 1,
                        transition: "all 0.2s ease",
                        position: "relative",
                        "&:hover": {
                          bgcolor: "rgba(25, 118, 210, 0.08)",
                          color: "#1976d2",
                        },
                        "&::before": activeTab === item.key ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "25%",
                          bottom: "25%",
                          width: "3px",
                          bgcolor: "#1976d2",
                          borderRadius: "0 3px 3px 0",
                        } : {},
                      }}
                    >
                      <Box sx={{ flexGrow: 1, textAlign: "left" }}>{item.label}</Box>
                      {item.key === "admin" && pendingCount > 0 && (
                        <Badge badgeContent={pendingCount} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "10px", height: 16, minWidth: 16 } }} />
                      )}
                    </Button>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Collapse>
      </Stack>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Refresh */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Button
          onClick={onRefresh}
          startIcon={RefreshIcon}
          variant="outlined"
          fullWidth
          sx={{
            color: "#5d7186",
            borderColor: "#d8dfe7",
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 500,
            py: 0.75,
            "&:hover": { borderColor: "#1976d2", bgcolor: "rgba(25,118,210,0.06)", color: "#1976d2" },
          }}
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );
}

Sidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  pendingCount: PropTypes.number,
};
