import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import { useLanguage } from "../i18n/LanguageContext";
import {CloseIcon, MenuIcon, PlusIcon, CheckIcon, SettingsIcon, RefreshIcon, CalendarIcon, ChevronDownIcon, PeopleIcon} from "./common/SideBarIcons";

import {EventDef} from "../event/EventDef";
import EventPublisher from "../event/EventPublisher";

const SIDEBAR_W = 250;
const MODULE = 'Sidebar';

export default function Sidebar({ activeTab, onTabChange, onRefresh, pendingCount = 0, mobileOpen = false, onClose }) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(true);
  const [permission, setPermission] = useState(localStorage.getItem("milal_permission") || "");
  const [title, setTitle] = useState(localStorage.getItem("milal_title") || "");
  const [cellGroup, setCellGroup] = useState(localStorage.getItem("milal_cell_group") || "");
  const [navItems, setNavItems] = useState([]);

  useEffect(() => {
    EventPublisher.addEventListener(EventDef.onLoginSuccess, MODULE, onLoginSuccess);
    return () => {
      EventPublisher.removeEventListener(EventDef.onLoginSuccess, MODULE);
    };
  }, []);

  // Update nav items when language changes
  useEffect(() => {
    const items = [
      { key: "timeline", label: t("navTimeline"), icon: MenuIcon, badge: null },
      { key: "request", label: t("navRequest"), icon: PlusIcon, badge: null },
    ];
    
    if (permission === "admin") {
      items.push({ key: "admin", label: t("navAdmin"), icon: CheckIcon, badge: null });
      items.push({ key: "space-settings", label: t("navSettings"), icon: SettingsIcon, badge: null });
    }
    
    setNavItems(items);
  }, [t, permission, title]);

  const onLoginSuccess = (event) => {
    console.log('onLoginSuccess event received:', event);
    setPermission(event.permission);
    setTitle(event.title || "");
    setCellGroup(event.cellGroup || "");
    // navItems will be automatically updated by the useEffect above
  }

  const sidebarContent = (
    <Box
      sx={{
        width: SIDEBAR_W,
        height: "100%",
        bgcolor: "#eef2f7",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Mobile close button */}
      <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "flex-end", px: 1.5, pt: 1 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: "#5d7186" }}>
          {CloseIcon}
        </IconButton>
      </Box>

      {/* Sidebar Header - Velok Branding */}
      <Box sx={{ p: 3, pb: 2, pt: { xs: 1, md: 3 } }}>
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
                {t("sidebarRooms")}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ bgcolor: "rgba(0, 0, 0, 0.08)" }} />

      {/* Navigation Tree */}
      <Stack sx={{ p: 1.5, pb: 2 }}>
        {/* Cell Group Info - Top level button for 순장 users */}
        {title === "순장" && (
          <Tooltip title={t("navCellGroupInfo")} placement="right">
            <Button
              onClick={() => onTabChange("cell-group")}
              startIcon={PeopleIcon}
              sx={{
                justifyContent: "flex-start",
                color: activeTab === "cell-group" ? "#1976d2" : "#313b5e",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 700,
                bgcolor: activeTab === "cell-group" ? "rgba(25, 118, 210, 0.08)" : "transparent",
                borderRadius: "8px",
                px: 1.5,
                py: 1.1,
                transition: "all 0.2s ease",
                mb: 1,
                position: "relative",
                "&:hover": {
                  bgcolor: "rgba(25, 118, 210, 0.08)",
                  color: "#1976d2",
                },
                "&::before": activeTab === "cell-group" ? {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: "15%",
                  bottom: "15%",
                  width: "3px",
                  bgcolor: "#1976d2",
                  borderRadius: "0 3px 3px 0",
                } : {},
              }}
            >
              <Box sx={{ flexGrow: 1, textAlign: "left" }}>{t("navCellGroupInfo")}</Box>
            </Button>
          </Tooltip>
        )}

        {/* Root: Milal Community */}
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
          <Box sx={{ flexGrow: 1, textAlign: "left" }}>{t("navRoomReservation")}</Box>
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
          {t("navRefresh")}
        </Button>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        {sidebarContent}
      </Box>

      {/* Mobile: temporary drawer */}
      <Drawer
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_W, boxSizing: "border-box", bgcolor: "#eef2f7" },
        }}
      >
        {sidebarContent}
      </Drawer>
    </>
  );
}

Sidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  pendingCount: PropTypes.number,
  mobileOpen: PropTypes.bool,
  onClose: PropTypes.func,
};
