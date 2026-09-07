import { useEffect, useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../../api";
import { useLanguage } from "../../lang/LanguageContext";

export default function ExpenseAgreementManagement() {
  const { t } = useLanguage();
  const [approvers, setApprovers] = useState([]);
  const [agreement, setAgreement] = useState(null);
  const [draft, setDraft] = useState({ reviewer_member_id: "", first_approver_member_id: "", second_approver_member_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextApprovers, nextAgreement] = await Promise.all([
        api.getExpenseApprovers(),
        api.getExpenseAgreement().catch(() => null),
      ]);
      setApprovers(nextApprovers);
      setAgreement(nextAgreement);
      if (nextAgreement) {
        setDraft({
          reviewer_member_id: String(nextAgreement.reviewer_member_id),
          first_approver_member_id: String(nextAgreement.first_approver_member_id),
          second_approver_member_id: String(nextAgreement.second_approver_member_id),
        });
      } else {
        setDraft({ reviewer_member_id: "", first_approver_member_id: "", second_approver_member_id: "" });
      }
    } catch (loadError) {
      setError(loadError.message || t("expenseAgreementLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!draft.reviewer_member_id || !draft.first_approver_member_id || !draft.second_approver_member_id || 
        draft.reviewer_member_id === draft.first_approver_member_id ||
        draft.reviewer_member_id === draft.second_approver_member_id ||
        draft.first_approver_member_id === draft.second_approver_member_id) {
      setError("지출 검토자, 1차 합의자, 2차 합의자를 모두 서로 다르게 지정해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveExpenseAgreement({
        reviewer_member_id: Number(draft.reviewer_member_id),
        first_approver_member_id: Number(draft.first_approver_member_id),
        second_approver_member_id: Number(draft.second_approver_member_id),
      });
      setAgreement(saved);
      setError("");
    } catch (saveError) {
      setError(saveError.message || t("expenseAgreementSaveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}>

        <Stack spacing={3} sx={{ p: 3 }}>
          {error && (
            <Box sx={{ p: 1.5, bgcolor: "#ffebee", border: "1px solid #ef5350", borderRadius: "6px" }}>
              <Typography sx={{ color: "#d32f2f", fontSize: "14px" }}>{error}</Typography>
            </Box>
          )}

          <FormControl fullWidth required>
            <InputLabel>{t("expenseAgreementReviewer")}</InputLabel>
            <Select
              label={t("expenseAgreementReviewer")}
              value={draft.reviewer_member_id}
              onChange={(event) => setDraft((prev) => ({ ...prev, reviewer_member_id: event.target.value }))}
            >
              <MenuItem value=""><em>선택해주세요</em></MenuItem>
              {approvers.map((approver) => (
                <MenuItem key={approver.id} value={String(approver.id)}>
                  {approver.name} ({approver.title})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>{t("expenseAgreementFirstApprover")}</InputLabel>
            <Select
              label={t("expenseAgreementFirstApprover")}
              value={draft.first_approver_member_id}
              onChange={(event) => setDraft((prev) => ({ ...prev, first_approver_member_id: event.target.value }))}
            >
              <MenuItem value=""><em>선택해주세요</em></MenuItem>
              {approvers.map((approver) => (
                <MenuItem key={approver.id} value={String(approver.id)}>
                  {approver.name} ({approver.title})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>{t("expenseAgreementSecondApprover")}</InputLabel>
            <Select
              label={t("expenseAgreementSecondApprover")}
              value={draft.second_approver_member_id}
              onChange={(event) => setDraft((prev) => ({ ...prev, second_approver_member_id: event.target.value }))}
            >
              <MenuItem value=""><em>선택해주세요</em></MenuItem>
              {approvers.map((approver) => (
                <MenuItem key={approver.id} value={String(approver.id)}>
                  {approver.name} ({approver.title})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {agreement && (
            <Box sx={{ p: 2, bgcolor: "#e8f5e9", border: "1px solid #4caf50", borderRadius: "6px" }}>
              <Typography sx={{ fontWeight: 700, color: "#2e7d32", fontSize: "14px", mb: 1 }}>
                현재 설정된 경로
              </Typography>
              <Stack spacing={1}>
                <Typography sx={{ fontSize: "13px", color: "#1b5e20" }}>
                  🔹 지출 검토: <strong>{agreement.reviewer_name}</strong>
                </Typography>
                <Typography sx={{ fontSize: "13px", color: "#1b5e20" }}>
                  🔹 1차 합의자: <strong>{agreement.first_approver_name}</strong>
                </Typography>
                <Typography sx={{ fontSize: "13px", color: "#1b5e20" }}>
                  🔹 2차 합의자: <strong>{agreement.second_approver_name}</strong>
                </Typography>
              </Stack>
            </Box>
          )}

          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={save}
            disabled={saving || !draft.reviewer_member_id || !draft.first_approver_member_id || !draft.second_approver_member_id}
            sx={{
              bgcolor: "#3b522e",
              textTransform: "none",
              fontWeight: 700,
              py: 1.2,
              "&:hover": { bgcolor: "#2f4325" },
            }}
          >
            {saving ? "저장 중..." : t("expenseSave")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
