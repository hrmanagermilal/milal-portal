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
    day_of_week: "",
    specific_date: "",
    target: "all", // all | youth | adult
    applies_all_day: true,
    start_time: "",
    end_time: "",
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

    if (newRule.rule_type === "day_of_week" && newRule.day_of_week === "") {
      setError("요일을 선택해주세요");
      return;
    }
    if (newRule.rule_type === "specific_date" && !newRule.specific_date) {
      setError("날짜를 선택해주세요");
      return;
    }
    if (!newRule.applies_all_day) {
      if (!newRule.start_time || !newRule.end_time) {
        setError("시간대 규칙은 시작 시간과 종료 시간을 모두 입력해주세요");
        return;
      }
      if (newRule.end_time <= newRule.start_time) {
        setError("종료 시간은 시작 시간보다 늦어야 합니다");
        return;
      }
    }

    try {
      const payload = {
        rule_type: newRule.rule_type,
        applies_all_day: newRule.applies_all_day,
        is_allowed: newRule.is_allowed,
      };

      if (newRule.rule_type === "day_of_week") {
        payload.day_of_week = Number(newRule.day_of_week);
      } else if (newRule.rule_type === "specific_date") {
        payload.specific_date = newRule.specific_date;
      }

      if (newRule.target !== "all") {
        payload.membership_category = newRule.target;
      }

      if (!newRule.applies_all_day) {
        payload.start_time = newRule.start_time;
        payload.end_time = newRule.end_time;
      }

      await api.adminCreateRoomRule(roomId, payload);
      setSuccess("규칙이 추가되었습니다");
      setNewRule({
        rule_type: "day_of_week",
        day_of_week: "",
        specific_date: "",
        target: "all",
        applies_all_day: true,
        start_time: "",
        end_time: "",
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

  const getRuleDescription = (rule) => {
    const status = rule.is_allowed ? "허용" : "금지";
    const target = rule.membership_category
      ? rule.membership_category === "youth"
        ? "청년부"
        : "장년부"
      : "모두";
    const scope = rule.applies_all_day || (!rule.start_time && !rule.end_time)
      ? "종일"
      : `${String(rule.start_time).slice(0, 5)}~${String(rule.end_time).slice(0, 5)}`;

    if (rule.rule_type === "day_of_week") {
      const dayName = DAYS_OF_WEEK.find((d) => d.value === rule.day_of_week)?.label;
      return `요일(${dayName || "미지정"}) / 대상(${target}) / ${scope} / ${status}`;
    } else if (rule.rule_type === "specific_date") {
      return `날짜(${rule.specific_date}) / 대상(${target}) / ${scope} / ${status}`;
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
                day_of_week: "",
                specific_date: "",
                target: "all",
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
              value={newRule.day_of_week}
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
              label="대상"
              value={newRule.target}
              onChange={(e) => setNewRule((prev) => ({ ...prev, target: e.target.value }))}
              fullWidth
              size="small"
              helperText="모두/청년/장년 중 적용 대상을 선택하세요"
            >
              <MenuItem value="all">모두</MenuItem>
              <MenuItem value="youth">청년부</MenuItem>
              <MenuItem value="adult">장년부</MenuItem>
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
              label="대상"
              value={newRule.target}
              onChange={(e) => setNewRule((prev) => ({ ...prev, target: e.target.value }))}
              fullWidth
              size="small"
              helperText="모두/청년/장년 중 적용 대상을 선택하세요"
            >
              <MenuItem value="all">모두</MenuItem>
              <MenuItem value="youth">청년부</MenuItem>
              <MenuItem value="adult">장년부</MenuItem>
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

        <Stack spacing={2} sx={{ mb: 4, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            시간 범위 설정
          </Typography>
          <TextField
            select
            label="적용 범위"
            value={newRule.applies_all_day ? "all_day" : "time_range"}
            onChange={(e) =>
              setNewRule((prev) => ({
                ...prev,
                applies_all_day: e.target.value === "all_day",
                start_time: e.target.value === "all_day" ? "" : prev.start_time,
                end_time: e.target.value === "all_day" ? "" : prev.end_time,
              }))
            }
            fullWidth
            size="small"
          >
            <MenuItem value="all_day">종일</MenuItem>
            <MenuItem value="time_range">특정 시간대</MenuItem>
          </TextField>

          {!newRule.applies_all_day && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="time"
                label="시작 시간"
                value={newRule.start_time}
                onChange={(e) => setNewRule((prev) => ({ ...prev, start_time: e.target.value }))}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="time"
                label="종료 시간"
                value={newRule.end_time}
                onChange={(e) => setNewRule((prev) => ({ ...prev, end_time: e.target.value }))}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          )}
        </Stack>

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
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "hidden" }}>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <TableHead sx={{ bgcolor: "#eef2f7" }}>
                <TableRow>
                  <TableCell sx={{ color: "#313b5e", fontWeight: 700 }}>규칙 설명</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell align="center" sx={{ py: 3, color: "#999" }}>
                      설정된 규칙이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id} hover>
                      <TableCell sx={{ width: "100%" }}>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{
                              color: "#313b5e",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {getRuleDescription(rule)}
                          </Typography>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="삭제"
                            sx={{ flexShrink: 0, p: 0.25 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
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
            • 월요일 청년부 종일 예약 금지 → 요일(월요일) + 대상(청년부) + 종일 + 금지
          </Typography>
          <Typography variant="caption" component="div">
            • 특정 날짜 장년부 오전만 예약 허용 → 날짜 + 대상(장년부) + 09:00~12:00 + 허용
          </Typography>
          <Typography variant="caption" component="div">
            • 특정 날짜 전체 대상 18:00~20:00 예약 금지 → 날짜 + 대상(모두) + 시간대 + 금지
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
