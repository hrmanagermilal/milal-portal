import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export default function TopBar({ userName = "", pageTitle = "", onLogout }) {
  const [anchorEl, setAnchorEl] = useState(null);

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
        left: 250, // sidebar width
        width: "calc(100% - 250px)",
      }}
    >
      <Toolbar sx={{ minHeight: "52px !important", px: 3, display: "flex", alignItems: "center" }}>
        {/* Page Title */}
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: "#313b5e", flexGrow: 1, fontSize: "15px" }}
        >
          {pageTitle}
        </Typography>

        {/* Right side: user profile */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            cursor: "pointer",
            py: 0.5,
            px: 1.5,
            borderRadius: "8px",
            transition: "background 0.15s",
            "&:hover": { bgcolor: "#f8f9fa" },
          }}
        >
          {/* Avatar */}
          <Box
            sx={{
              width: 32, height: 32, borderRadius: "50%",
              bgcolor: "#1976d2",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(25,118,210,0.3)",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "white" }}>
              {initials}
            </Typography>
          </Box>

          {/* Name */}
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "#1976d2", fontSize: "14px" }}
          >
            {userName || "Guest"}
          </Typography>

          {/* Chevron */}
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
            onClick={() => setAnchorEl(null)}
            sx={{ fontSize: "14px", color: "#313b5e", py: 1, gap: 1.5, "&:hover": { bgcolor: "rgba(25,118,210,0.06)", color: "#1976d2" } }}
          >
            <Box sx={{ fontSize: "16px" }}>👤</Box> My Account
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem
            onClick={() => { setAnchorEl(null); if (onLogout) onLogout(); }}
            sx={{ fontSize: "14px", color: "#f95c5c", py: 1, gap: 1.5, fontWeight: 600, "&:hover": { bgcolor: "rgba(249,92,92,0.06)" } }}
          >
            <Box sx={{ fontSize: "16px" }}>↩</Box> Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
