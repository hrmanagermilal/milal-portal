import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import { useLanguage } from "../i18n/LanguageContext";
import { api } from "../api";

export default function MyAccountModal({ open, onClose, targetMemberId = null, isEditingOther = false }) {
  const { t } = useLanguage();
  const [memberInfo, setMemberInfo] = useState(null);
  const [editableInfo, setEditableInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchMemberInfo = async () => {
        try {
          setLoading(true);
          let data;
          if (isEditingOther && targetMemberId) {
            data = await api.getMember(targetMemberId);
          } else {
            data = await api.getMyAccountInfo();
          }
          setMemberInfo(data);
          setEditableInfo({
            car_plate: data.car_plate || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
          });
          setError("");
        } catch (err) {
          setError(err.message || "Failed to fetch member information.");
        } finally {
          setLoading(false);
        }
      };
      fetchMemberInfo();
    }
  }, [open, targetMemberId, isEditingOther]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditableInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      if (isEditingOther && targetMemberId) {
        await api.updateMember(targetMemberId, editableInfo);
      } else {
        await api.updateMyAccountInfo(editableInfo);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update information.");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("All password fields are required");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess("Password changed successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setPasswordSuccess("");
      }, 3000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const dialogTitle = isEditingOther ? `${t("editMember")} - ${memberInfo?.name}` : t("myAccount");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: "18px", fontWeight: 600, pb: 2 }}>
        {dialogTitle}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Typography sx={{ py: 4, textAlign: "center" }}>
            {t("loading")}...
          </Typography>
        )}
        {error && (
          <Typography
            color="error"
            sx={{ mb: 2, p: 2, bgcolor: "error.light", borderRadius: 1 }}
          >
            {error}
          </Typography>
        )}
        {memberInfo && !loading && (
          <Box sx={{ pt: 2 }}>
            {/* Read-only Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                bgcolor: "background.paper",
                border: "1px solid #e0e0e0",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#333",
                }}
              >
                {t("memberInfo") || "Member Information"}
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 3,
                }}
              >
                {/* Name */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                    }}
                  >
                    {t("name")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "15px",
                      color: "#333",
                      p: 1.5,
                      bgcolor: "#f5f5f5",
                      borderRadius: 0.5,
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    {memberInfo.name}
                  </Typography>
                </Box>

                {/* Title */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                    }}
                  >
                    {t("title")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "15px",
                      color: "#333",
                      p: 1.5,
                      bgcolor: "#f5f5f5",
                      borderRadius: 0.5,
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    {memberInfo.title}
                  </Typography>
                </Box>

                {/* Cell Group */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                    }}
                  >
                    {t("cellGroup")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "15px",
                      color: "#333",
                      p: 1.5,
                      bgcolor: "#f5f5f5",
                      borderRadius: 0.5,
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    {memberInfo.cell_group}
                  </Typography>
                </Box>

                {/* Permission */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                    }}
                  >
                    {t("permission")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "15px",
                      color: "#333",
                      p: 1.5,
                      bgcolor: "#f5f5f5",
                      borderRadius: 0.5,
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    {memberInfo.permission}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Editable Information Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: "background.paper",
                border: "1px solid #e0e0e0",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#333",
                }}
              >
                {t("editableInfo") || "Edit Information"}
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 3,
                }}
              >
                {/* Email */}
                <Box>
                  <Typography
                    component="label"
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                      display: "block",
                    }}
                  >
                    {t("email")}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="email"
                    type="email"
                    placeholder={t("email")}
                    value={editableInfo.email}
                    onChange={handleInputChange}
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        fontSize: "15px",
                        borderRadius: 0.5,
                        "& fieldset": {
                          borderColor: "#e0e0e0",
                        },
                        "&:hover fieldset": {
                          borderColor: "#bdbdbd",
                        },
                      },
                    }}
                  />
                </Box>

                {/* Phone */}
                <Box>
                  <Typography
                    component="label"
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                      display: "block",
                    }}
                  >
                    {t("phone")}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="phone"
                    type="tel"
                    placeholder={t("phone")}
                    value={editableInfo.phone}
                    onChange={handleInputChange}
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        fontSize: "15px",
                        borderRadius: 0.5,
                        "& fieldset": {
                          borderColor: "#e0e0e0",
                        },
                        "&:hover fieldset": {
                          borderColor: "#bdbdbd",
                        },
                      },
                    }}
                  />
                </Box>

                {/* Car Plate */}
                <Box>
                  <Typography
                    component="label"
                    sx={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#666",
                      mb: 0.8,
                      display: "block",
                    }}
                  >
                    Car Plate
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    name="car_plate"
                    type="text"
                    placeholder="Enter car plate"
                    value={editableInfo.car_plate}
                    onChange={handleInputChange}
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        fontSize: "15px",
                        borderRadius: 0.5,
                        "& fieldset": {
                          borderColor: "#e0e0e0",
                        },
                        "&:hover fieldset": {
                          borderColor: "#bdbdbd",
                        },
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Address - Full Width */}
              <Box sx={{ mt: 3 }}>
                <Typography
                  component="label"
                  sx={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#666",
                    mb: 0.8,
                    display: "block",
                  }}
                >
                  {t("address")}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  name="address"
                  placeholder={t("address")}
                  value={editableInfo.address}
                  onChange={handleInputChange}
                  variant="outlined"
                  multiline
                  rows={3}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      fontSize: "15px",
                      borderRadius: 0.5,
                      backgroundColor: "#f9f9f9",
                      "& fieldset": {
                        borderColor: "#e0e0e0",
                      },
                      "&:hover fieldset": {
                        borderColor: "#bdbdbd",
                      },
                    },
                  }}
                />
              </Box>
            </Paper>

            {/* Password Change Section - Only for current user */}
            {!isEditingOther && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mt: 3,
                  bgcolor: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "#333",
                  }}
                >
                  {t("changePassword") || "Change Password"}
                </Typography>
                <Divider sx={{ mb: 3 }} />

                {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
                {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>}

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
                  {/* Current Password */}
                  <Box>
                    <Typography
                      component="label"
                      sx={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#666",
                        mb: 0.8,
                        display: "block",
                      }}
                    >
                      {t("currentPassword") || "Current Password"}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      placeholder="Enter your current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      disabled={changingPassword}
                      variant="outlined"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "15px",
                          borderRadius: 0.5,
                          "& fieldset": {
                            borderColor: "#e0e0e0",
                          },
                          "&:hover fieldset": {
                            borderColor: "#bdbdbd",
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* New Password */}
                  <Box>
                    <Typography
                      component="label"
                      sx={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#666",
                        mb: 0.8,
                        display: "block",
                      }}
                    >
                      {t("newPassword") || "New Password"}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      placeholder="Enter your new password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      disabled={changingPassword}
                      variant="outlined"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "15px",
                          borderRadius: 0.5,
                          "& fieldset": {
                            borderColor: "#e0e0e0",
                          },
                          "&:hover fieldset": {
                            borderColor: "#bdbdbd",
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* Confirm Password */}
                  <Box>
                    <Typography
                      component="label"
                      sx={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#666",
                        mb: 0.8,
                        display: "block",
                      }}
                    >
                      {t("confirmPassword") || "Confirm Password"}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      placeholder="Confirm your new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      disabled={changingPassword}
                      variant="outlined"
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: "15px",
                          borderRadius: 0.5,
                          "& fieldset": {
                            borderColor: "#e0e0e0",
                          },
                          "&:hover fieldset": {
                            borderColor: "#bdbdbd",
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* Change Password Button */}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    sx={{
                      textTransform: "none",
                      fontSize: "15px",
                      fontWeight: 500,
                      mt: 1,
                    }}
                  >
                    {changingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </Box>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: "1px solid #e0e0e0" }}>
        <Button
          onClick={onClose}
          sx={{
            textTransform: "none",
            fontSize: "15px",
            color: "#666",
            "&:hover": {
              bgcolor: "#f5f5f5",
            },
          }}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            textTransform: "none",
            fontSize: "15px",
            fontWeight: 500,
          }}
        >
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

MyAccountModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  targetMemberId: PropTypes.number,
  isEditingOther: PropTypes.bool,
};
