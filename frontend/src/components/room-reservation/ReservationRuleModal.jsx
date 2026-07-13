import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../api";

const DAYS_OF_WEEK = [
  { value: 0, label: "월요일 (Monday)" },
  { value: 1, label: "화요일 (Tuesday)" },
  { value: 2, label: "수요일 (Wednesday)" },
  { value: 3, label: "목요일 (Thursday)" },
  { value: 4, label: "금요일 (Friday)" },
  { value: 5, label: "토요일 (Saturday)" },
  { value: 6, label: "일요일 (Sunday)" },
];

export default function ReservationRuleModal({ open, roomId, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newRule, setNewRule] = useState({
    rule_type: "day_of_week",
    day_of_week: null,
    target: "all", // "all", "youth", "adult"
    specific_date: "",
    is_allowed: true,
  });

  async function loadRules() {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetRoomRules(roomId);
      setRules(data);
    } catch (err) {
      setError(err.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && roomId) {
      loadRules();
    }
  }, [open, roomId]);

  async function handleAddRule() {
    setError("");
    setSuccess("");

    if (newRule.rule_type === "day_of_week" && newRule.day_of_week === null) {
      setError("요일을 선택해주세요");
      return;
    }
    if (newRule.rule_type === "specific_date" && !newRule.specific_date) {
      setError("날짜를 선택해주세요");
      return;
    }

    try {
      const payload = {
        rule_type: newRule.rule_type,
        is_allowed: newRule.is_allowed,
      };

      if (newRule.rule_type === "day_of_week") {
        payload.day_of_week = newRule.day_of_week;
        // target이 "all"이면 membership_category는 null로
        if (newRule.target !== "all") {
          payload.membership_category = newRule.target;
        }
      } else if (newRule.rule_type === "specific_date") {
        payload.specific_date = newRule.specific_date;
      }

      await api.adminCreateRoomRule(roomId, payload);
      setSuccess("규칙이 추가되었습니다");
      setNewRule({
        rule_type: "day_of_week",
        day_of_week: null,
        target: "all",
        specific_date: "",
        is_allowed: true,
      });
      await loadRules();
    } catch (err) {
      setError(err.message || "Failed to add rule");
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!window.confirm("이 규칙을 삭제하시겠습니까?")) return;

    setError("");
    setSuccess("");
    try {
      await api.adminDeleteRoomRule(roomId, ruleId);
      setSuccess("규칙이 삭제되었습니다");
      await loadRules();
    } catch (err) {
      setError(err.message || "Failed to delete rule");
    }
  }

  async function handleToggleRule(ruleId, currentIsAllowed) {
    setError("");
    setSuccess("");
    try {
      await api.adminUpdateRoomRule(roomId, ruleId, { is_allowed: !currentIsAllowed });
      setSuccess("규칙이 업데이트되었습니다");
      await loadRules();
    } catch (err) {
      setError(err.message || "Failed to update rule");
    }
  }

  const getRuleDescription = (rule) => {
    if (rule.rule_type === "day_of_week") {
      const dayName = DAYS_OF_WEEK.find((d) => d.value === rule.day_of_week)?.label;
      const target = rule.membership_category
        ? rule.membership_category === "youth"
          ? "청년부"
          : "장년부"
        : "모두";
      const status = rule.is_allowed ? "✅ 예약 가능" : "❌ 예약 불가";
      return `${dayName} - ${target} ${status}`;
    } else if (rule.rule_type === "specific_date") {
      const status = rule.is_allowed ? "✅ 예약 가능" : "❌ 예약 불가";
      return `${rule.specific_date} - ${status}`;
    }
    return "";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>예약 규칙 설정</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Rule Type Selection */}
        <Box sx={{ mb: 3, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            규칙 유형 선택
          </Typography>
          <TextField
            select
            label="규칙 유형"
            value={newRule.rule_type}
            onChange={(e) =>
              setNewRule((prev) => ({
                ...prev,
                rule_type: e.target.value,
                day_of_week: null,
                target: "all",
                specific_date: "",
              }))
            }
            fullWidth
            size="small"
          >
            <MenuItem value="day_of_week">요일별 규칙</MenuItem>
            <MenuItem value="specific_date">특정 날짜 규칙</MenuItem>
          </TextField>
        </Box>

        {/* Day of Week Rule Configuration */}
        {newRule.rule_type === "day_of_week" && (
          <Stack spacing={2} sx={{ mb: 4, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              요일별 규칙 설정
            </Typography>
            <TextField
              select
              label="요일 선택"
              value={newRule.day_of_week ?? ""}
              onChange={(e) => setNewRule((prev) => ({ ...prev, day_of_week: e.target.value }))}
              fullWidth
              size="small"
            >
              {DAYS_OF_WEEK.map((day) => (
                <MenuItem key={day.value} value={day.value}>
                  {day.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="대상 선택"
              value={newRule.target}
              onChange={(e) => setNewRule((prev) => ({ ...prev, target: e.target.value }))}
              fullWidth
              size="small"
              helperText="'모두'를 선택하면 모든 소속에 적용됩니다"
            >
              <MenuItem value="all">모두 (모든 소속)</MenuItem>
              <MenuItem value="youth">청년부만</MenuItem>
              <MenuItem value="adult">장년부만</MenuItem>
            </TextField>

            <TextField
              select
              label="허용 여부"
              value={newRule.is_allowed ? "allowed" : "denied"}
              onChange={(e) => setNewRule((prev) => ({ ...prev, is_allowed: e.target.value === "allowed" }))}
              fullWidth
              size="small"
            >
              <MenuItem value="allowed">✅ 예약 허용</MenuItem>
              <MenuItem value="denied">❌ 예약 거부</MenuItem>
            </TextField>
          </Stack>
        )}

        {/* Specific Date Rule Configuration */}
        {newRule.rule_type === "specific_date" && (
          <Stack spacing={2} sx={{ mb: 4, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              특정 날짜 규칙 설정
            </Typography>
            <TextField
              type="date"
              label="날짜 선택"
              value={newRule.specific_date}
              onChange={(e) => setNewRule((prev) => ({ ...prev, specific_date: e.target.value }))}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              select
              label="허용 여부"
              value={newRule.is_allowed ? "allowed" : "denied"}
              onChange={(e) => setNewRule((prev) => ({ ...prev, is_allowed: e.target.value === "allowed" }))}
              fullWidth
              size="small"
            >
              <MenuItem value="allowed">✅ 예약 허용</MenuItem>
              <MenuItem value="denied">❌ 예약 거부</MenuItem>
            </TextField>
          </Stack>
        )}

        <Button variant="contained" onClick={handleAddRule} fullWidth sx={{ mb: 3, bgcolor: "#2f68f9" }}>
          규칙 추가
        </Button>

        {/* Rules List */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          설정된 규칙
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: "#eef2f7" }}>
                <TableRow>
                  <TableCell sx={{ color: "#313b5e", fontWeight: 700 }}>규칙 설명</TableCell>
                  <TableCell sx={{ color: "#313b5e", fontWeight: 700 }} align="center">
                    동작
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} align="center" sx={{ py: 3, color: "#999" }}>
                      설정된 규칙이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id} hover>
                      <TableCell>{getRuleDescription(rule)}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="삭제"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Example Rules */}
        <Box sx={{ mt: 3, p: 2, bgcolor: "#f0f8ff", borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            📝 예시
          </Typography>
          <Typography variant="caption" component="div" sx={{ mt: 1 }}>
            • 일요일에는 청년부가 예약할 수 있다 → 요일(일요일) + 대상(청년부) + 허용
          </Typography>
          <Typography variant="caption" component="div">
            • 일요일에는 청년부가 예약할 수 없다 → 요일(일요일) + 대상(청년부) + 거부
          </Typography>
          <Typography variant="caption" component="div">
            • 월요일에는 모두가 예약할 수 없다 → 요일(월요일) + 대상(모두) + 거부
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
