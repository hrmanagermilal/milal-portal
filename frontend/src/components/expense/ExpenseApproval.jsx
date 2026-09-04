import { useEffect, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Pagination,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import { api } from "../../api";
import DataMart from "../../common/DataMart";
import { useLanguage } from "../../i18n/LanguageContext";

const FILTERS = ["", "reviewing", "approved", "rejected"];

function formatDateTime(value, korean) {
  if (!value) return korean ? "-" : "-";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(korean ? "ko-KR" : "en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Toronto",
  }).format(timestamp);
}

export default function ExpenseApproval({ initialExpenseId = null, onApprovalChanged }) {
  const { lang, t } = useLanguage();
  const korean = lang === "ko";
  const [filter, setFilter] = useState("");
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [approvers, setApprovers] = useState([]);
  const [secondApproverId, setSecondApproverId] = useState("");
  const [previewFile, setPreviewFile] = useState(null);

  const selected = requests.find((request) => request.id === selectedId) || null;
  const pageCount = Math.max(1, Math.ceil(requests.length / 10));
  const displayedRequests = requests.slice((page - 1) * 10, page * 10);
  const currentApprovalIndex = selected?.approvals?.findIndex((approval) => approval.state === "current") ?? -1;
  const currentApprovalEntry = currentApprovalIndex >= 0 ? selected.approvals[currentApprovalIndex] : null;
  const hasPendingApproval = Boolean(currentApprovalEntry);
  const currentMemberId = DataMart.getCurrentUser()?.member_id;
  const isMyTurn = Boolean(currentApprovalEntry && currentMemberId && currentApprovalEntry.member_id === currentMemberId);
  const isFirstApprovalStep = currentApprovalIndex === 1;
  const formatCurrency = (amount) => `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusLabel = (status) => ({ reviewing: korean ? "1차 결재" : "First approval", approved: korean ? "2차 결재" : "Second approval", rejected: korean ? "반려" : "Rejected", paid: korean ? "완료" : "Completed" })[status] || status;
  const statusChipSx = (status) => ({
    fontSize: "11px",
    bgcolor: status === "paid" ? "#e8f5ed" : status === "approved" ? "#e9f0ff" : status === "rejected" ? "#fdeaea" : "#fff4df",
    color: status === "paid" ? "#226a43" : status === "approved" ? "#2756a5" : status === "rejected" ? "#b23737" : "#9a6500",
  });

  async function loadRequests(activeFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getExpenseApprovals(activeFilter);
      setRequests(data);
      setSelectedId((current) => data.some((request) => String(request.id) === initialExpenseId) ? data.find((request) => String(request.id) === initialExpenseId).id : (data.some((request) => request.id === current) ? current : (data[0]?.id ?? null)));
      setComment("");
      setPage(1);
    } catch (loadError) {
      setError(loadError.message || "Unable to load expense approvals.");
      setRequests([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [filter]);

  useEffect(() => {
    api.getExpenseAccounts().then(setAccounts).catch((loadError) => setError(loadError.message || "Unable to load expense accounts."));
    api.getExpenseApprovers().then(setApprovers).catch((loadError) => setError(loadError.message || "Unable to load expense approvers."));
  }, []);

  useEffect(() => {
    const request = requests.find((item) => item.id === selectedId);
    setAccountId(request?.account_id ? String(request.account_id) : "");
    setSecondApproverId(request?.approvals?.[2]?.member_id ? String(request.approvals[2].member_id) : "");
  }, [selectedId, requests]);

  async function decide(action) {
    if (!selected || processing || !isMyTurn || !comment.trim()) return;
    const prompt = action === "approve"
      ? (korean ? "이 비용 요청을 결재하시겠습니까?" : "Approve this expense request?")
      : (korean ? "이 비용 요청을 반려하시겠습니까?" : "Reject this expense request?");
    if (!window.confirm(prompt)) return;

    setProcessing(true);
    setError("");
    try {
      await api.decideExpenseApproval(selected.id, action, comment.trim(), Number(accountId) || null, isFirstApprovalStep ? Number(secondApproverId) || null : null);
      await loadRequests();
      onApprovalChanged?.();
    } catch (decisionError) {
      setError(decisionError.message || "Unable to process this expense request.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {FILTERS.map((value) => <Button key={value || "all"} variant={filter === value ? "contained" : "outlined"} onClick={() => setFilter(value)} sx={{ textTransform: "none", fontWeight: 700, color: filter === value ? "white" : "#3b522e", bgcolor: filter === value ? "#3b522e" : "white", borderColor: "#b8c5d1", "&:hover": { bgcolor: filter === value ? "#2f4325" : "#f3f7f1" } }}>{value ? statusLabel(value) : (korean ? "전체" : "All")}</Button>)}
      </Stack>
      {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}

      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "hidden" }}><Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}><TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}>
            <TableCell sx={{ width: { xs: "42%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186" }}>{korean ? "제목" : "Title"}</TableCell><TableCell sx={{ width: { xs: "30%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "요청자" : "Requester"}</TableCell><TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "총금액" : "Total"}</TableCell><TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "요청일" : "Date"}</TableCell><TableCell sx={{ width: { xs: "28%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "상태" : "Status"}</TableCell>
          </TableRow></TableHead><TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}><CircularProgress size={22} /></TableCell></TableRow> : requests.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: "#8493a2" }}>{korean ? "결재할 비용 요청이 없습니다." : "No expense requests await your approval."}</TableCell></TableRow> : displayedRequests.map((request) => <TableRow key={request.id} hover selected={selected?.id === request.id} onClick={() => setSelectedId(request.id)} sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(59,82,46,0.08)" } }}>
              <TableCell sx={{ fontWeight: 700, color: "#313b5e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.title}</TableCell><TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.requester_name}</TableCell><TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap", fontWeight: 700 }}>{formatCurrency(request.total_amount)}</TableCell><TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>{formatDateTime(request.created_at, korean)}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}><Chip label={statusLabel(request.status)} size="small" sx={statusChipSx(request.status)} /></TableCell>
            </TableRow>)}
          </TableBody></Table></TableContainer>
          {requests.length > 10 && <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: "1px solid #e8edf3" }}><Pagination count={pageCount} page={Math.min(page, pageCount)} onChange={(_, nextPage) => setPage(nextPage)} size="small" color="primary" /></Box>}
        </Paper>

        <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", minHeight: 360 }}>
          {selected ? <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}><Box><Typography sx={{ fontSize: "12px", color: "#5d7186", fontWeight: 700 }}>{formatDateTime(selected.created_at, korean)} · {selected.requester_name}</Typography><Typography variant="h6" sx={{ color: "#313b5e", fontWeight: 800, mt: 0.5 }}>{selected.title}</Typography></Box><Chip label={statusLabel(selected.status)} sx={{ alignSelf: "flex-start", fontWeight: 700, bgcolor: "#eef2f7", color: "#3b522e" }} /></Stack>
            <Divider /><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 1 }}>{t("expenseExpenseItems")}</Typography><TableContainer sx={{ width: "100%", overflowX: "hidden" }}><Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}><TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}><TableCell sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186" }}>{t("expenseItemName")}</TableCell><TableCell align="right" sx={{ width: 128, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{t("expenseAmount")}</TableCell></TableRow></TableHead><TableBody>{selected.items.map((item, index) => <TableRow key={`${item.description}-${index}`}><TableCell sx={{ overflowWrap: "anywhere" }}>{item.description}</TableCell><TableCell align="right" sx={{ width: 128, fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(item.amount)}</TableCell></TableRow>)}<TableRow><TableCell sx={{ fontWeight: 800 }}>{t("expenseHst")}</TableCell><TableCell align="right" sx={{ width: 128, fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(selected.hst_amount)}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 800, color: "#313b5e" }}>{t("expenseTotal")}</TableCell><TableCell align="right" sx={{ width: 128, fontWeight: 800, color: "#3b522e", fontSize: "17px", whiteSpace: "nowrap" }}>{formatCurrency(selected.total_amount)}</TableCell></TableRow></TableBody></Table></TableContainer></Box>
            <Box><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 0.75 }}>{korean ? "메모" : "Memo"}</Typography><Typography variant="body2" sx={{ color: "#536579" }}>{selected.memo}</Typography></Box>
            <Box><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 0.75 }}>{korean ? "첨부 파일" : "Attachments"}</Typography><Stack spacing={1.5}>{selected.attachments.map((file, index) => <Box key={`${file.name}-${index}`} onClick={() => file.url && setPreviewFile(file)} sx={{ border: "1px solid #d8dfe7", borderRadius: "6px", overflow: "hidden", cursor: file.url ? "zoom-in" : "default" }}><Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1, py: 0.75, bgcolor: "#f6f8fa" }}>{file.type === "pdf" ? <DescriptionIcon fontSize="small" /> : <InsertDriveFileIcon fontSize="small" />}<Typography variant="caption" sx={{ fontWeight: 700, flexGrow: 1 }}>{file.name}</Typography>{file.url && <OpenInNewIcon fontSize="small" sx={{ color: "#5d7186" }} />}</Stack>{file.url && (file.type === "pdf" ? <Box component="iframe" src={file.url} title={file.name} sx={{ display: "block", border: 0, width: "100%", height: 440, pointerEvents: "none" }} /> : <Box component="img" src={file.url} alt={file.name} sx={{ display: "block", width: "100%", maxHeight: 520, objectFit: "contain", bgcolor: "#f6f8fa" }} />)}</Box>)}</Stack></Box>
            <Box><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 1 }}>{korean ? "결재 의견" : "Approval Comments"}</Typography><Stack spacing={1}>{selected.approvals.map((approval, index) => <Box key={`${approval.member_id || approval.role}-${index}`} sx={{ borderLeft: "3px solid", borderColor: approval.state === "rejected" ? "#c34a4a" : approval.state === "done" ? "#4d8c62" : "#c6d0db", pl: 1.25 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" sx={{ fontWeight: 700, color: "#313b5e" }}>{korean ? approval.roleKo : approval.role} · {approval.name}</Typography><Typography variant="caption" sx={{ color: "#68788a", whiteSpace: "nowrap" }}>{formatDateTime(approval.date, korean)}</Typography></Stack>{approval.comment && <Typography variant="body2" sx={{ color: "#536579", mt: 0.5, whiteSpace: "pre-wrap" }}>{approval.comment}</Typography>}</Box>)}</Stack></Box>
            {hasPendingApproval && <><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth required size="small" disabled={!isMyTurn}>
                <InputLabel>{korean ? "계정" : "Account"}</InputLabel>
                <Select label={korean ? "계정" : "Account"} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  {accounts.map((account) => <MenuItem key={account.id} value={String(account.id)}>{account.account_code} · {account.name}</MenuItem>)}
                </Select>
              </FormControl>
              {isFirstApprovalStep && <FormControl fullWidth required size="small" disabled={!isMyTurn}>
                <InputLabel>{korean ? "2차 결재자" : "Second Approver"}</InputLabel>
                <Select label={korean ? "2차 결재자" : "Second Approver"} value={secondApproverId} onChange={(event) => setSecondApproverId(event.target.value)}>
                  {approvers.map((approver) => <MenuItem key={approver.id} value={String(approver.id)}>{approver.name}{approver.title ? ` (${approver.title})` : ""}</MenuItem>)}
                </Select>
              </FormControl>}
            </Stack><TextField label={korean ? "의견" : "Comment"} value={comment} onChange={(event) => setComment(event.target.value)} multiline rows={3} required fullWidth disabled={!isMyTurn} placeholder={korean ? "승인 또는 반려 의견을 입력하세요." : "Enter an approval or rejection comment."} />
            <Stack direction="row" justifyContent="flex-end" spacing={1}><Button variant="outlined" color="error" startIcon={<CloseIcon />} disabled={!isMyTurn || processing || !comment.trim()} onClick={() => decide("reject")} sx={{ textTransform: "none", fontWeight: 700 }}>{korean ? "반려" : "Reject"}</Button><Button variant="contained" startIcon={<CheckIcon />} disabled={!isMyTurn || processing || !comment.trim() || !accountId || (isFirstApprovalStep && !secondApproverId)} onClick={() => decide("approve")} sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#3b522e", "&:hover": { bgcolor: "#2f4325" } }}>{korean ? "결재 승인" : "Approve"}</Button></Stack></>}
          </Stack> : <Box sx={{ minHeight: 360, display: "grid", placeItems: "center", color: "#8493a2" }}><Typography>{korean ? "결재할 요청을 선택하세요." : "Select a request to review."}</Typography></Box>}
        </Paper>
      </Stack>
      <Dialog open={Boolean(previewFile)} onClose={() => setPreviewFile(null)} maxWidth="lg" fullWidth><DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>{previewFile?.name}<Button component="a" href={previewFile?.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />} sx={{ ml: "auto", textTransform: "none" }}>{korean ? "새 창" : "New window"}</Button></DialogTitle><DialogContent dividers sx={{ p: 0, bgcolor: "#f6f8fa" }}>{previewFile?.type === "pdf" ? <Box component="iframe" src={previewFile.url} title={previewFile.name} sx={{ display: "block", border: 0, width: "100%", height: "75vh" }} /> : <Box component="img" src={previewFile?.url} alt={previewFile?.name} sx={{ display: "block", width: "100%", height: "75vh", objectFit: "contain" }} />}</DialogContent></Dialog>
    </Box>
  );
}