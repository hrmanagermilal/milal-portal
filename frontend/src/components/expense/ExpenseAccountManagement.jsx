import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, TextField, Typography,
} from "@mui/material";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

const EMPTY_ACCOUNT = { account_code: "", name: "", year: String(new Date().getFullYear()), budget_amount: "" };

function formatCurrency(amount, korean) {
  return `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpenseAccountManagement({ onOpenDetail }) {
  const { lang } = useLanguage();
  const korean = lang === "ko";
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseSort, setExpenseSort] = useState({ key: "request_date", direction: "desc" });

  async function loadAccounts(preferredId) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getExpenseAccounts();
      setAccounts(data);
      const next = data.find((account) => account.id === preferredId) || data.find((account) => account.id === selected?.id) || null;
      setSelected(next);
    } catch (loadError) {
      setError(loadError.message || "Unable to load expense accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    Promise.all([api.getExpenseAccount(selected.id), api.getExpenseAccountCategories(selected.id)])
      .then(([accountDetail, categories]) => setDetail({ ...accountDetail, categories }))
      .catch((loadError) => setError(loadError.message || "Unable to load account details."));
  }, [selected?.id]);

  function openAccountDialog(account = null) {
    setEditingAccountId(account?.id || null);
    setAccountForm(account ? { account_code: account.account_code || "", name: account.name, year: String(account.year), budget_amount: String(account.budget_amount) } : EMPTY_ACCOUNT);
    setCategoryName("");
    setEditingCategoryId(null);
    if (account) {
      api.getExpenseAccountCategories(account.id)
        .then((categories) => setDetail({ ...account, categories }))
        .catch((loadError) => setError(loadError.message || "Unable to load expense categories."));
    } else {
      setDetail(null);
    }
    setAccountDialogOpen(true);
  }

  async function saveAccount() {
    if (!accountForm.account_code.trim() || !accountForm.name.trim() || !Number(accountForm.budget_amount) || !Number(accountForm.year)) return;
    try {
      const payload = { account_code: accountForm.account_code.trim(), name: accountForm.name.trim(), year: Number(accountForm.year), budget_amount: Number(accountForm.budget_amount) };
      const saved = editingAccountId ? await api.updateExpenseAccount(editingAccountId, payload) : await api.createExpenseAccount(payload);
      setAccountDialogOpen(false);
      await loadAccounts(saved.id);
    } catch (saveError) { setError(saveError.message || "Unable to save expense account."); }
  }

  async function saveCategory() {
    if (!editingAccountId || !categoryName.trim()) return;
    try {
      if (editingCategoryId) await api.updateExpenseAccountCategory(editingCategoryId, { name: categoryName.trim() });
      else await api.createExpenseAccountCategory(editingAccountId, { name: categoryName.trim() });
      setCategoryName("");
      setEditingCategoryId(null);
      const categories = await api.getExpenseAccountCategories(editingAccountId);
      setDetail((current) => current ? { ...current, categories } : current);
    } catch (saveError) { setError(saveError.message || "Unable to save category."); }
  }

  async function deleteCategory(category) {
    if (!window.confirm(korean ? `"${category.name}" 카테고리를 삭제하시겠습니까?` : `Delete "${category.name}"?`)) return;
    try {
      await api.deleteExpenseAccountCategory(category.id);
      const categories = await api.getExpenseAccountCategories(editingAccountId);
      setDetail((current) => current ? { ...current, categories } : current);
    } catch (deleteError) { setError(deleteError.message || "Unable to delete category."); }
  }

  const categories = detail?.categories || [];
  const approvedExpenses = detail?.expenses || [];
  const sortedExpenses = [...approvedExpenses].sort((left, right) => {
    const leftValue = left[expenseSort.key] ?? "";
    const rightValue = right[expenseSort.key] ?? "";
    const comparison = expenseSort.key === "total_amount"
      ? Number(leftValue) - Number(rightValue)
      : String(leftValue).localeCompare(String(rightValue), korean ? "ko-KR" : "en-CA");
    return expenseSort.direction === "asc" ? comparison : -comparison;
  });
  const expensePageCount = Math.max(1, Math.ceil(sortedExpenses.length / 10));
  const pagedExpenses = sortedExpenses.slice((expensePage - 1) * 10, expensePage * 10);

  function changeExpenseSort(key) {
    setExpenseSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setExpensePage(1);
  }

  useEffect(() => {
    setExpensePage(1);
  }, [detail?.id]);

  return <Box>
    {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}
    <Box>
      <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}><TableContainer sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: 480, tableLayout: "fixed" }}><TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}><TableCell sx={{ width: 100, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "계정코드" : "Code"}</TableCell><TableCell sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "계정" : "Account"}</TableCell><TableCell align="right" sx={{ width: 150, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "승인 금액" : "Approved"}</TableCell></TableRow></TableHead><TableBody>{loading ? <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}><CircularProgress size={22} /></TableCell></TableRow> : accounts.length ? accounts.map((account) => <TableRow key={account.id} hover onClick={() => onOpenDetail(account.id)} sx={{ cursor: "pointer" }}><TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.account_code || "-"}</TableCell><TableCell sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</TableCell><TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(account.approved_amount, korean)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5, color: "#8493a2" }}>{korean ? "등록된 계정이 없습니다." : "No accounts found."}</TableCell></TableRow>}</TableBody></Table></TableContainer></Paper>
    </Box>
    <Dialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} maxWidth="sm" fullWidth><DialogTitle>{editingAccountId ? (korean ? "계정 수정" : "Edit Account") : (korean ? "계정 생성" : "Create Account")}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={korean ? "계정명" : "Account name"} value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required fullWidth /><TextField label={korean ? "연도" : "Year"} type="number" value={accountForm.year} onChange={(event) => setAccountForm((current) => ({ ...current, year: event.target.value }))} required fullWidth /><TextField label={korean ? "예산 금액 (CAD)" : "Budget amount (CAD)"} type="number" value={accountForm.budget_amount} onChange={(event) => setAccountForm((current) => ({ ...current, budget_amount: event.target.value }))} required fullWidth />{editingAccountId && <Box><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 1 }}>{korean ? "1차 카테고리" : "First-level Categories"}</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" fullWidth label={korean ? "카테고리명" : "Category name"} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><Button variant="outlined" onClick={saveCategory} sx={{ whiteSpace: "nowrap", color: "#3b522e", borderColor: "#b8c5d1" }}>{editingCategoryId ? (korean ? "수정" : "Save") : (korean ? "추가" : "Add")}</Button></Stack><Stack spacing={.5} sx={{ mt: 1.5 }}>{categories.length ? categories.map((category) => <Stack key={category.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ borderBottom: "1px solid #edf0f3", py: .75 }}><Typography variant="body2">{category.name}</Typography><Box><IconButton size="small" aria-label="Edit category" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" aria-label="Delete category" onClick={() => deleteCategory(category)}><CloseIcon fontSize="small" /></IconButton></Box></Stack>) : <Typography variant="body2" sx={{ color: "#8493a2" }}>{korean ? "등록된 카테고리가 없습니다." : "No categories found."}</Typography>}</Stack></Box>}</Stack></DialogContent><DialogActions><Button onClick={() => setAccountDialogOpen(false)}>{korean ? "취소" : "Cancel"}</Button><Button variant="contained" onClick={saveAccount} sx={{ bgcolor: "#3b522e" }}>{korean ? "저장" : "Save"}</Button></DialogActions></Dialog>
  </Box>;
}