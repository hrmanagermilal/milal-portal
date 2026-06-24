import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../i18n/LanguageContext";
import MyAccountModal from "./MyAccountModal";

const HamburgerIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const GlobeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="10" />
    <ellipse cx="12" cy="12" rx="4" ry="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="5" x2="19.07" y2="5" />
    <line x1="4.93" y1="19" x2="19.07" y2="19" />
  </svg>
);

const SIDEBAR_W = 250;

export default function TopBar({ userName = "", pageTitle = "", subtitle = "", onLogout, onMenuClick, isMobile = false }) {
  const { lang, setLanguage, t } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const [langAnchor, setLangAnchor] = useState(null);
  const [myAccountOpen, setMyAccountOpen] = useState(false);

  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: "white",
        borderBottom: "1px solid #eef2f7",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        left: isMobile ? 0 : SIDEBAR_W,
        width: isMobile ? "100%" : `calc(100% - ${SIDEBAR_W}px)`,
      }}
    >
      <Toolbar sx={{ minHeight: "52px !important", px: { xs: 1.5, md: 3 }, display: "flex", alignItems: "center", gap: 1 }}>
        {/* Hamburger – mobile only */}
        {isMobile && (
          <IconButton
            onClick={onMenuClick}
            size="small"
            sx={{ color: "#313b5e", mr: 0.5 }}
          >
            {HamburgerIcon}
          </IconButton>
        )}

        {/* Page Title and Subtitle */}
        <Stack spacing={0.3} sx={{ flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: "#313b5e", fontSize: { xs: "14px", md: "15px" }, noWrap: true }}
          >
            {pageTitle}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{ color: "#8486a7", fontSize: { xs: "11px", md: "12px" }, noWrap: true }}
            >
              {subtitle}
            </Typography>
          )}
        </Stack>

        {/* Language switcher */}
        <IconButton
          size="small"
          onClick={(e) => setLangAnchor(e.currentTarget)}
          sx={{
            color: "#5d7186",
            "&:hover": { color: "#1976d2", bgcolor: "rgba(25,118,210,0.07)" },
          }}
        >
          {GlobeIcon}
        </IconButton>
        <Menu
          anchorEl={langAnchor}
          open={Boolean(langAnchor)}
          onClose={() => setLangAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ sx: { mt: 0.5, minWidth: 110, borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", border: "1px solid #eef2f7" } }}
        >
          {[{ code: "en", label: "English" }, { code: "ko", label: "한국어" }].map(({ code, label }) => (
            <MenuItem
              key={code}
              selected={lang === code}
              onClick={() => { setLanguage(code); setLangAnchor(null); }}
              sx={{ fontSize: "13px", fontWeight: lang === code ? 700 : 400, color: lang === code ? "#1976d2" : "#313b5e", "&.Mui-selected": { bgcolor: "rgba(25,118,210,0.06)" } }}
            >
              {label}
            </MenuItem>
          ))}
        </Menu>

        {/* Right side: user profile */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            cursor: "pointer",
            py: 0.5,
            px: { xs: 1, md: 1.5 },
            borderRadius: "8px",
            transition: "background 0.15s",
            "&:hover": { bgcolor: "#f8f9fa" },
          }}
        >
          {/* Avatar */}
          <Box
            sx={{
              width: 30, height: 30, borderRadius: "50%",
              bgcolor: "#1976d2",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(25,118,210,0.3)",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "white" }}>
              {initials}
            </Typography>
          </Box>

          {/* Name – hide on very small screens */}
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "#1976d2", fontSize: "13px", display: { xs: "none", sm: "block" } }}
          >
            {userName || t("guest")}
          </Typography>

          <Typography sx={{ color: "#8486a7", fontSize: "12px", mt: "1px" }}>▾</Typography>
        </Stack>

        {/* Dropdown Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{
            sx: {
              width: 210,
              mt: 1,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              border: "1px solid #eef2f7",
              borderRadius: "10px",
              py: 0.5,
            },
          }}
        >
          <MenuItem
            onClick={() => { setAnchorEl(null); setMyAccountOpen(true); }}
            sx={{ fontSize: "14px", color: "#313b5e", py: 1, gap: 1.5, "&:hover": { bgcolor: "rgba(25,118,210,0.06)", color: "#1976d2" } }}
          >
            <Box sx={{ fontSize: "16px" }}>👤</Box> {t("myAccount")}
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem
            onClick={() => { setAnchorEl(null); if (onLogout) onLogout(); }}
            sx={{ fontSize: "14px", color: "#f95c5c", py: 1, gap: 1.5, fontWeight: 600, "&:hover": { bgcolor: "rgba(249,92,92,0.06)" } }}
          >
            <Box sx={{ fontSize: "16px" }}>↩</Box> {t("logout")}
          </MenuItem>
        </Menu>
      </Toolbar>
      <MyAccountModal open={myAccountOpen} onClose={() => setMyAccountOpen(false)} />
    </AppBar>
  );
}
