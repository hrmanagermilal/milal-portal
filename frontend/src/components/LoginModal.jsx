import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export default function LoginModal({ open, onLogin }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    onLogin(name.trim());
  }

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogContent sx={{ p: 0 }}>
        {/* Header band */}
        <Box sx={{ bgcolor: "#1976d2", px: 4, py: 4, textAlign: "center" }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              bgcolor: "white",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          >
            <Typography sx={{ fontSize: "28px", fontWeight: 800, color: "#1976d2" }}>M</Typography>
          </Box>
          <Typography variant="h6" sx={{ color: "white", fontWeight: 800 }}>
            Milal Rooms
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", mt: 0.5 }}>
            장소 예약 시스템에 오신 것을 환영합니다
          </Typography>
        </Box>

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ px: 4, py: 3 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "#313b5e", mb: 0.75 }}>
                이름 *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="홍길동"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                error={!!error}
                helperText={error}
                autoFocus
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{
                bgcolor: "#1976d2",
                py: 1.25,
                fontWeight: 700,
                fontSize: "15px",
                "&:hover": { bgcolor: "#1565c0" },
                boxShadow: "0 4px 12px rgba(25,118,210,0.3)",
              }}
            >
              시작하기
            </Button>

            <Typography variant="caption" sx={{ color: "#8486a7", textAlign: "center", display: "block" }}>
              로그인 없이 이름만 입력하면 됩니다.<br />예약 시 전화번호와 이메일이 필요합니다.
            </Typography>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
