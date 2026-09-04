import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper,
  Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

export default function ExpenseApprovalRouteManagement() {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseGroupDialog, setExpenseGroupDialog] = useState(null);
  const [expenseGroupForm, setExpenseGroupForm] = useState({ account_code: "", name: "", year: String(new Date().getFullYear()), budget_amount: "" });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [viewMode, setViewMode] = useState("card");
  const [searchQuery, setSearchQuery] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextDepartments, nextApprovers, nextRoutes] = await Promise.all([
        api.getExpenseAccounts(), api.getExpenseApprovers(), api.getExpenseApprovalRoutes(),
      ]);
      setDepartments(nextDepartments);
      setApprovers(nextApprovers);
      setRoutes(nextRoutes);
      setDrafts(Object.fromEntries(nextDepartments.map((department) => {
        const route = nextRoutes.find((item) => item.account_id === department.id);
        return [department.id, {
          account_code: department.account_code || "",
          name: department.name || "",
          chairperson_member_id: route ? String(route.chairperson_member_id) : "",
          finance_elder_member_id: route ? String(route.finance_elder_member_id) : "",
        }];
      })));
    } catch (loadError) {
      setError(loadError.message || t("expenseApprovalRouteLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(departmentId) {
    const draft = drafts[departmentId];
    const department = departments.find((item) => item.id === departmentId);
    if (!department || !draft?.account_code?.trim() || !draft?.name?.trim() || !draft?.chairperson_member_id || !draft?.finance_elder_member_id) return;
    try {
      await Promise.all([
        api.updateExpenseAccount(departmentId, {
          account_code: draft.account_code.trim(),
          name: draft.name.trim(),
          year: department.year,
          budget_amount: department.budget_amount,
        }),
        api.saveExpenseApprovalRoute(departmentId, {
          chairperson_member_id: Number(draft.chairperson_member_id),
          finance_elder_member_id: Number(draft.finance_elder_member_id),
        }),
      ]);
      await load();
    } catch (saveError) {
      setError(saveError.message || t("expenseApprovalRouteSaveError"));
    }
  }

  function openExpenseGroupDialog() {
    setExpenseGroupForm({ account_code: "", name: "", year: String(new Date().getFullYear()), budget_amount: "" });
    setExpenseGroupDialog(true);
  }

  async function saveExpenseGroup() {
    const accountCode = expenseGroupForm.account_code.trim();
    const year = Number(expenseGroupForm.year);
    const budgetAmount = Number(expenseGroupForm.budget_amount);
    if (!accountCode || !expenseGroupForm.name.trim() || !Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isFinite(budgetAmount) || budgetAmount < 0) {
      setError("위원회 코드, 예산항목명, 연도, 예산액을 올바르게 입력하세요.");
      return;
    }
    try {
      await api.createExpenseAccount({
        account_code: accountCode,
        name: expenseGroupForm.name.trim(),
        year,
        budget_amount: budgetAmount,
      });
      setExpenseGroupDialog(null);
      await load();
    } catch (saveError) {
      setError(saveError.message || t("expenseExpenseGroupCreateError"));
    }
  }

  function hasUnsavedChanges(department, draft) {
    const route = routes.find((item) => item.account_id === department.id);
    return draft.account_code !== (department.account_code || "")
      || draft.name !== (department.name || "")
      || draft.chairperson_member_id !== (route ? String(route.chairperson_member_id) : "")
      || draft.finance_elder_member_id !== (route ? String(route.finance_elder_member_id) : "");
  }

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId);
  const memberName = (memberId) => {
    const member = approvers.find((item) => String(item.id) === String(memberId));
    return member ? `${member.name}${member.title ? ` (${member.title})` : ""}` : "-";
  };
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const displayedDepartments = departments.filter((department) => {
    if (!normalizedSearchQuery) return true;
    const route = routes.find((item) => item.account_id === department.id);
    return [
      department.account_code,
      department.name,
      memberName(route?.chairperson_member_id),
      memberName(route?.finance_elder_member_id),
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearchQuery));
  });
  const handleViewModeChange = (_, nextViewMode) => {
    if (nextViewMode) setViewMode(nextViewMode);
  };

  if (selectedDepartment) {
    const draft = drafts[selectedDepartment.id] || {};
    const canSave = draft.account_code?.trim() && draft.name?.trim() && draft.chairperson_member_id && draft.finance_elder_member_id && hasUnsavedChanges(selectedDepartment, draft);
    return <Box>
      {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}
      <Button startIcon={<ArrowBackIcon />} onClick={() => setSelectedDepartmentId(null)} sx={{ mb: 2, color: "#3b522e", textTransform: "none", fontWeight: 700 }}>{t("back")}</Button>
      <Paper elevation={0} sx={{ maxWidth: 720, border: "1px solid #e0e6ef", borderRadius: "8px", p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ color: "#313b5e", fontWeight: 800, mb: 3 }}>{t("expenseApprovalRouteManagement")}</Typography>
        <Stack spacing={2}>
          <TextField label={t("expenseAccountCode")} value={draft.account_code || ""} onChange={(event) => setDrafts((current) => ({ ...current, [selectedDepartment.id]: { ...draft, account_code: event.target.value } }))} required fullWidth inputProps={{ maxLength: 100 }} />
          <TextField label={t("expenseDepartment")} value={draft.name || ""} onChange={(event) => setDrafts((current) => ({ ...current, [selectedDepartment.id]: { ...draft, name: event.target.value } }))} required fullWidth inputProps={{ maxLength: 255 }} />
          <FormControl fullWidth><InputLabel>{`${t("expenseChairperson")} (${t("expenseFirstApproval")})`}</InputLabel><Select label={`${t("expenseChairperson")} (${t("expenseFirstApproval")})`} value={draft.chairperson_member_id || ""} onChange={(event) => setDrafts((current) => ({ ...current, [selectedDepartment.id]: { ...draft, chairperson_member_id: event.target.value } }))}>{approvers.map((member) => <MenuItem key={member.id} value={String(member.id)}>{member.name}{member.title ? ` (${member.title})` : ""}</MenuItem>)}</Select></FormControl>
          <FormControl fullWidth><InputLabel>{`${t("expenseFinanceElder")} (${t("expenseSecondApproval")})`}</InputLabel><Select label={`${t("expenseFinanceElder")} (${t("expenseSecondApproval")})`} value={draft.finance_elder_member_id || ""} onChange={(event) => setDrafts((current) => ({ ...current, [selectedDepartment.id]: { ...draft, finance_elder_member_id: event.target.value } }))}>{approvers.map((member) => <MenuItem key={member.id} value={String(member.id)}>{member.name}{member.title ? ` (${member.title})` : ""}</MenuItem>)}</Select></FormControl>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1 }}><Typography variant="body2" sx={{ color: "#5d7186" }}>{t("expenseBudgetAmountColumn")}</Typography><Typography sx={{ color: "#313b5e", fontWeight: 800 }}>CAD {Number(selectedDepartment.budget_amount || 0).toLocaleString()}</Typography></Box>
          <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={() => save(selectedDepartment.id)} sx={{ alignSelf: "flex-end", bgcolor: "#3b522e", textTransform: "none", "&:hover": { bgcolor: "#2f4325" } }}>{t("expenseSave")}</Button>
        </Stack>
      </Paper>
    </Box>;
  }

  return <Box>
    {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
      <Stack direction="row" spacing={1} sx={{ flex: "1 1 320px", alignItems: "center" }}>
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small" aria-label="보기 옵션">
          <Tooltip title="카드 보기"><ToggleButton value="card" aria-label="카드 보기"><ViewModuleIcon fontSize="small" /></ToggleButton></Tooltip>
          <Tooltip title="리스트 보기"><ToggleButton value="list" aria-label="리스트 보기"><ViewListIcon fontSize="small" /></ToggleButton></Tooltip>
        </ToggleButtonGroup>
        <TextField value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="계정 코드, 항목 또는 결재자 검색" size="small" fullWidth InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "#718096", mr: 1 }} /> }} inputProps={{ "aria-label": "계정 코드, 항목 또는 결재자 검색" }} />
      </Stack>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => openExpenseGroupDialog()} sx={{ bgcolor: "#3b522e", textTransform: "none", "&:hover": { bgcolor: "#2f4325" } }}>{t("expenseCreateExpenseGroup")}</Button>
    </Box>
    {loading ? <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress size={24} /></Box> : <><Box sx={viewMode === "card" ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 } : { display: "grid", gap: 1 }}>{displayedDepartments.map((department) => {
      const route = routes.find((item) => item.account_id === department.id);
      if (viewMode === "list") return <Paper key={department.id} elevation={0} onClick={() => setSelectedDepartmentId(department.id)} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", px: { xs: 2, sm: 2.5 }, py: 1.75, cursor: "pointer", transition: "border-color .2s, box-shadow .2s", "&:hover": { borderColor: "#3b522e", boxShadow: "0 3px 12px rgba(49, 59, 94, .12)" } }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "90px minmax(180px, 1.6fr) minmax(130px, 1fr) minmax(130px, 1fr) 110px" }, gap: { xs: .75, sm: 2 }, alignItems: "center" }}><Typography variant="body2" sx={{ color: "#5d7186", fontWeight: 700 }}>{department.account_code || "-"}</Typography><Typography sx={{ color: "#313b5e", fontWeight: 800 }}>{department.name}</Typography><Typography variant="body2" sx={{ color: "#5d7186" }}>{t("expenseChairperson")} · {memberName(route?.chairperson_member_id)}</Typography><Typography variant="body2" sx={{ color: "#5d7186" }}>{t("expenseFinanceElder")} · {memberName(route?.finance_elder_member_id)}</Typography><Typography variant="body2" sx={{ color: "#3b522e", fontWeight: 800, textAlign: { sm: "right" } }}>CAD {Number(department.budget_amount || 0).toLocaleString()}</Typography></Box></Paper>;
      return <Paper key={department.id} elevation={0} onClick={() => setSelectedDepartmentId(department.id)} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", p: 2.25, cursor: "pointer", transition: "border-color .2s, box-shadow .2s", "&:hover": { borderColor: "#3b522e", boxShadow: "0 3px 12px rgba(49, 59, 94, .12)" } }}><Stack spacing={1.25}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}><Typography variant="caption" sx={{ color: "#5d7186", fontWeight: 700 }}>{department.account_code || "-"}</Typography><Typography variant="caption" sx={{ color: "#3b522e", fontWeight: 800 }}>CAD {Number(department.budget_amount || 0).toLocaleString()}</Typography></Box><Typography sx={{ color: "#313b5e", fontWeight: 800 }}>{department.name}</Typography><Box sx={{ borderTop: "1px solid #edf0f3", pt: 1.25 }}><Typography variant="caption" sx={{ display: "block", color: "#5d7186" }}>{t("expenseChairperson")} ({t("expenseFirstApproval")})</Typography><Typography variant="body2">{memberName(route?.chairperson_member_id)}</Typography></Box><Box><Typography variant="caption" sx={{ display: "block", color: "#5d7186" }}>{t("expenseFinanceElder")} ({t("expenseSecondApproval")})</Typography><Typography variant="body2">{memberName(route?.finance_elder_member_id)}</Typography></Box></Stack></Paper>;
    })}</Box>{!displayedDepartments.length && <Typography sx={{ py: 6, textAlign: "center", color: "#8493a2" }}>{t("noData")}</Typography>}</>}
    <Dialog open={Boolean(expenseGroupDialog)} onClose={() => setExpenseGroupDialog(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{t("expenseCreateExpenseGroup")}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label={t("expenseAccountCode")} value={expenseGroupForm.account_code} onChange={(event) => setExpenseGroupForm((current) => ({ ...current, account_code: event.target.value }))} required fullWidth inputProps={{ maxLength: 100 }} />
        <TextField label={t("expenseExpenseGroupName")} value={expenseGroupForm.name} onChange={(event) => setExpenseGroupForm((current) => ({ ...current, name: event.target.value }))} required fullWidth />
        <TextField label={t("expenseYear")} type="number" value={expenseGroupForm.year} onChange={(event) => setExpenseGroupForm((current) => ({ ...current, year: event.target.value }))} required fullWidth />
        <TextField label={t("expenseBudgetAmount")} type="number" value={expenseGroupForm.budget_amount} onChange={(event) => setExpenseGroupForm((current) => ({ ...current, budget_amount: event.target.value }))} required fullWidth inputProps={{ min: 0, step: "0.01" }} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setExpenseGroupDialog(null)}>{t("cancel")}</Button><Button variant="contained" onClick={saveExpenseGroup} sx={{ bgcolor: "#3b522e", "&:hover": { bgcolor: "#2f4325" } }}>{t("expenseCreateExpenseGroup")}</Button></DialogActions>
    </Dialog>
  </Box>;
}