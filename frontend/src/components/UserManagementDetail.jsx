import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import { useLanguage } from "../i18n/LanguageContext";
import { api } from "../api";

export default function UserManagementDetail({ open, onClose, user, onUserUpdated }) {
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(user?.is_admin || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleAdminToggle(event) {
    const newValue = event.target.checked;
    setIsAdmin(newValue);
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.adminUpdateUserAdmin(user.id, newValue);
      setSuccess(`Admin status updated to ${newValue ? "Admin" : "User"}`);
      if (onUserUpdated) {
        setTimeout(onUserUpdated, 1500);
      }
    } catch (err) {
      setError(err.message || "Failed to update admin status");
      setIsAdmin(!newValue); // Revert on error
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!window.confirm(`Reset password for ${user.member_name}? An email will be sent.`)) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await api.adminResetUserPassword(user.id);
      if (result.success) {
        setSuccess(`Password reset email sent to ${user.member_email}`);
      } else {
        setError(result.message || "Failed to send reset email");
      }
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, pr: 1, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eef2f7" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 4, height: 24, bgcolor: "#1976d2", borderRadius: "2px" }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e", fontSize: "15px" }}>
            {t("userDetail") || "User Details"}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: "#5d7186" }}>✕</IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Stack spacing={2}>
          {/* User Info */}
          <Box>
            <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", fontWeight: 600 }}>
              {t("name") || "Name"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#313b5e", fontWeight: 500, fontSize: "14px" }}>
              {user.member_name}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", fontWeight: 600 }}>
              {t("email") || "Email"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#313b5e", fontWeight: 500, fontSize: "14px" }}>
              {user.member_email}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", fontWeight: 600 }}>
              {t("phone") || "Phone"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#313b5e", fontWeight: 500, fontSize: "14px" }}>
              {user.member_phone}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: "#5d7186", textTransform: "uppercase", fontSize: "10px", fontWeight: 600 }}>
              {t("userId") || "User ID"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#313b5e", fontWeight: 500, fontSize: "14px" }}>
              {user.user_id}
            </Typography>
          </Box>

          <Divider />

          {/* Admin Toggle */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#f8f9fa", p: 1.5, borderRadius: 1 }}>
            <Stack>
              <Typography variant="body2" sx={{ color: "#313b5e", fontWeight: 600, fontSize: "13px" }}>
                {t("adminStatus") || "Admin Status"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#8486a7", fontSize: "12px" }}>
                {isAdmin ? t("isAdmin") : t("notAdmin") || "Regular user"}
              </Typography>
            </Stack>
            <Switch
              checked={isAdmin}
              onChange={handleAdminToggle}
              disabled={loading}
              color="primary"
            />
          </Box>

          <Divider />

          {/* Password Reset Button */}
          <Button
            variant="outlined"
            color="error"
            onClick={handleResetPassword}
            disabled={loading}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {t("resetPasswordButton") || "Reset Password & Send Email"}
          </Button>

          <Typography variant="caption" sx={{ color: "#8486a7", fontSize: "11px" }}>
            {t("resetPasswordDesc")?.replace("{email}", user.member_email) || `Clicking this button will generate a random temporary password and send it to ${user.member_email}. The user will need to log in with the temporary password and change it immediately.`}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
