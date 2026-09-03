import { useEffect, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box, Button, CircularProgress, Pagination, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Typography,
} from "@mui/material";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

const PAGE_SIZE = 10;

function formatCurrency(amount, korean) {
  return `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpenseAccountDetail({ accountId, onBack }) {
  const { lang } = useLanguage();
  const korean = lang === "ko";
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "request_date", direction: "desc" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    setError("");
    api.getExpenseAccount(accountId)
      .then(setAccount)
      .catch((loadError) => setError(loadError.message || "Unable to load account details."))
      .finally(() => setLoading(false));
  }, [accountId]);

  const expenses = [...(account?.expenses || [])].sort((left, right) => {
    const leftValue = left[sort.key] ?? "";
    const rightValue = right[sort.key] ?? "";
    const comparison = sort.key === "total_amount"
      ? Number(leftValue) - Number(rightValue)
      : String(leftValue).localeCompare(String(rightValue), korean ? "ko-KR" : "en-CA");
    return sort.direction === "asc" ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
  const displayedExpenses = expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeSort(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  const columns = [
    ["request_date", korean ? "요청일" : "Request date", "left"],
    ["title", korean ? "제목" : "Title", "left"],
    ["category_name", korean ? "카테고리" : "Category", "left"],
    ["total_amount", korean ? "금액" : "Amount", "right"],
  ];

  return <Box>
    <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2, color: "#3b522e", textTransform: "none", fontWeight: 700 }}>
      {korean ? "통계로 돌아가기" : "Back to account statistics"}
    </Button>
    {loading ? <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress size={24} /></Box> : error ? <Typography color="error">{error}</Typography> : account && <Stack spacing={3}>
      <Box><Typography variant="h5" sx={{ color: "#313b5e", fontWeight: 800 }}>{account.name}</Typography><Typography variant="body2" sx={{ color: "#5d7186", mt: 0.75 }}>{account.year} · {korean ? "예산" : "Budget"} {formatCurrency(account.budget_amount, korean)} · {korean ? "승인 금액" : "Approved"} {formatCurrency(account.approved_amount, korean)}</Typography></Box>
      <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}><Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #e8edf3" }}><Typography sx={{ color: "#313b5e", fontWeight: 800 }}>{korean ? "승인완료 비용 내역" : "Approved Expenses"}</Typography></Box><TableContainer><Table size="small"><TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}>{columns.map(([key, label, align]) => <TableCell key={key} align={align} sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}><TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.direction : "asc"} onClick={() => changeSort(key)}>{label}</TableSortLabel></TableCell>)}</TableRow></TableHead><TableBody>{displayedExpenses.length ? displayedExpenses.map((expense) => <TableRow key={expense.id}><TableCell>{expense.request_date}</TableCell><TableCell>{expense.title}</TableCell><TableCell>{expense.category_name || "-"}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(expense.total_amount, korean)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: "#8493a2" }}>{korean ? "승인완료된 비용이 없습니다." : "No approved expenses."}</TableCell></TableRow>}</TableBody></Table></TableContainer>{expenses.length > PAGE_SIZE && <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: "1px solid #e8edf3" }}><Pagination count={pageCount} page={Math.min(page, pageCount)} onChange={(_, nextPage) => setPage(nextPage)} size="small" /></Box>}</Paper>
    </Stack>}
  </Box>;
}