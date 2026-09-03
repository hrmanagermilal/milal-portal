import { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
import { useLanguage } from "../../i18n/LanguageContext";
import { api } from "../../api";

const INITIAL_REQUESTS = [
  {
    id: "EXP-2026-008",
    date: "2026-08-21",
    title: "Youth Summer Retreat Supplies",
    titleKo: "청년부 여름수련회 물품 구입",
    status: "approved",
    amount: 4867,
    memo: "수련회 공용 물품과 간식 구매 비용입니다.",
    items: [
      { description: "Snack and beverage", descriptionKo: "간식 및 음료", amount: 1845 },
      { description: "Program materials", descriptionKo: "프로그램 재료", amount: 2150 },
      { description: "First-aid supplies", descriptionKo: "구급 용품", amount: 872 },
    ],
    attachments: [
      { name: "retreat-receipts.pdf", type: "pdf" },
      { name: "supplies-photo.jpg", type: "image" },
    ],
    approvals: [
      { role: "Requester", roleKo: "요청자", name: "김민준", date: "2026-08-21", state: "done" },
      { role: "Chairperson", roleKo: "위원장", name: "이수진", date: "2026-08-22", state: "done" },
      { role: "Finance Elder", roleKo: "담당장로", name: "박성호", date: "2026-08-23", state: "done" },
    ],
  },
  {
    id: "EXP-2026-007",
    date: "2026-08-14",
    title: "Cell Group Meeting Meal",
    titleKo: "순모임 식사비",
    status: "reviewing",
    amount: 1380,
    memo: "8월 순모임 식사 및 다과 비용입니다.",
    items: [
      { description: "Meal", descriptionKo: "식사", amount: 1120 },
      { description: "Refreshments", descriptionKo: "다과", amount: 260 },
    ],
    attachments: [{ name: "august-cell-receipt.jpg", type: "image" }],
    approvals: [
      { role: "Requester", roleKo: "요청자", name: "김민준", date: "2026-08-14", state: "done" },
      { role: "Chairperson", roleKo: "위원장", name: "이수진", date: "2026-08-15", state: "current" },
      { role: "Finance Elder", roleKo: "담당장로", name: "박성호", date: "", state: "waiting" },
    ],
  },
  {
    id: "EXP-2026-006",
    date: "2026-07-29",
    title: "Sunday School Craft Materials",
    titleKo: "주일학교 만들기 재료",
    status: "paid",
    amount: 224,
    memo: "7월 주일학교 공예 활동 재료비입니다.",
    items: [{ description: "Craft materials", descriptionKo: "만들기 재료", amount: 224 }],
    attachments: [{ name: "craft-store-receipt.pdf", type: "pdf" }],
    approvals: [
      { role: "Requester", roleKo: "요청자", name: "김민준", date: "2026-07-29", state: "done" },
      { role: "Chairperson", roleKo: "위원장", name: "이수진", date: "2026-07-30", state: "done" },
      { role: "Finance Elder", roleKo: "담당장로", name: "박성호", date: "2026-08-02", state: "done" },
    ],
  },
];

const EMPTY_FORM = { title: "", date: new Date().toISOString().slice(0, 10), memo: "", hstAmount: "", approvalRouteId: "", firstApproverMemberId: "", secondApproverMemberId: "", items: [{ description: "", amount: "" }], files: [] };

function mapExpense(expense) {
  return {
    id: expense.id,
    date: expense.request_date,
    createdAt: expense.created_at,
    title: expense.title,
    titleKo: expense.title,
    status: expense.status,
    amount: expense.total_amount,
    hstAmount: expense.hst_amount || 0,
    memo: expense.memo,
    items: expense.items.map((item) => ({ ...item, descriptionKo: item.description })),
    attachments: expense.attachments,
    approvals: expense.approvals,
  };
}

function formatDateTime(value, korean) {
  if (!value) return korean ? "승인 대기" : "Waiting";
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the receipt file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function prepareReceiptForAnalysis(file) {
  if (!file.type.startsWith("image/")) return readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Unable to prepare the receipt image."));
    };
    image.onload = () => {
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, 2048 / largestSide);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(imageUrl);

      const dataUrl = [0.85, 0.7, 0.55]
        .map((quality) => canvas.toDataURL("image/jpeg", quality))
        .find((candidate) => candidate.length <= 9_000_000);
      if (!dataUrl) {
        reject(new Error("Receipt image is too large to analyze. Please use a smaller image."));
        return;
      }
      resolve(dataUrl);
    };
    image.src = imageUrl;
  });
}

export default function ExpensePanel({ initialExpenseId = null }) {
  const { lang } = useLanguage();
  const korean = lang === "ko";
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [extractingReceipt, setExtractingReceipt] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [approvalRoutes, setApprovalRoutes] = useState([]);
  const [loadingApprovalRoutes, setLoadingApprovalRoutes] = useState(false);
  const [page, setPage] = useState(1);
  const inputRef = useRef(null);
  const hasSelectedExpense = requests.some((request) => request.id === selectedId);
  const selected = requests.find((request) => request.id === selectedId) || requests[0] || { id: "-", date: "", title: "", titleKo: "", status: "reviewing", amount: 0, hstAmount: 0, memo: "", items: [], attachments: [], approvals: [] };
  const formatCurrency = (amount) => `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { maximumFractionDigits: 2 })}`;
  const status = (value) => ({ reviewing: korean ? "승인 진행 중" : "In review", approved: korean ? "1차 승인" : "First approved", paid: korean ? "승인완료" : "Paid", rejected: korean ? "반려" : "Rejected", cancelled: korean ? "요청 취소" : "Cancelled" })[value];
  const total = useMemo(() => form.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [form.items]);
  const hstAmount = Number(form.hstAmount) || 0;
  const totalWithHst = total + hstAmount;
  const isFormComplete = form.title.trim() && form.memo.trim() && form.files.length > 0 && form.approvalRouteId && form.firstApproverMemberId && form.secondApproverMemberId && form.items.every((item) => item.description.trim() && Number(item.amount) > 0);
  const pageCount = Math.max(1, Math.ceil(requests.length / 10));
  const displayedRequests = requests.slice((page - 1) * 10, page * 10);

  useEffect(() => {
    async function loadExpenses() {
      setLoading(true);
      setError("");
      try {
        const expenses = await api.getExpenses();
        const mappedExpenses = expenses.map(mapExpense);
        setRequests(mappedExpenses);
        setSelectedId(mappedExpenses.find((expense) => String(expense.id) === initialExpenseId)?.id ?? mappedExpenses[0]?.id ?? null);
        setPage(1);
      } catch (loadError) {
        setError(loadError.message || "Unable to load expense requests.");
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  function updateItem(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  async function loadApprovers() {
    setLoadingApprovers(true);
    try {
      setApprovers(await api.getExpenseApprovers());
    } catch (approverError) {
      setError(approverError.message || "Unable to load expense approvers.");
    } finally {
      setLoadingApprovers(false);
    }
  }

  async function loadApprovalRoutes() {
    setLoadingApprovalRoutes(true);
    try {
      setApprovalRoutes(await api.getExpenseApprovalRoutes());
    } catch (routeError) {
      setError(routeError.message || "Unable to load approval routes.");
    } finally {
      setLoadingApprovalRoutes(false);
    }
  }

  function selectApprovalRoute(routeId) {
    const route = approvalRoutes.find((candidate) => String(candidate.id) === routeId);
    setForm((current) => ({
      ...current,
      approvalRouteId: routeId,
      firstApproverMemberId: route ? String(route.chairperson_member_id) : "",
      secondApproverMemberId: route ? String(route.finance_elder_member_id) : "",
    }));
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    loadApprovers();
    loadApprovalRoutes();
  }

  function openEditDialog() {
    if (!hasSelectedExpense || selected.status !== "reviewing") return;
    setEditingId(selected.id);
    setForm({
      title: selected.title,
      date: selected.date,
      memo: selected.memo,
      hstAmount: String(selected.hstAmount || ""),
      approvalRouteId: "",
      firstApproverMemberId: String(selected.approvals[1]?.member_id || ""),
      secondApproverMemberId: String(selected.approvals[2]?.member_id || ""),
      items: selected.items.map((item) => ({ description: item.description, amount: String(item.amount) })),
      files: selected.attachments,
    });
    setDialogOpen(true);
    loadApprovers();
    loadApprovalRoutes().then(() => {
      setApprovalRoutes((routes) => {
        const route = routes.find((candidate) => candidate.chairperson_member_id === selected.approvals[1]?.member_id && candidate.finance_elder_member_id === selected.approvals[2]?.member_id);
        if (route) setForm((current) => ({ ...current, approvalRouteId: String(route.id) }));
        return routes;
      });
    });
  }

  async function cancelRequest() {
    if (!hasSelectedExpense || selected.status !== "reviewing") return;
    if (!window.confirm(korean ? "이 비용 요청을 취소하시겠습니까?" : "Cancel this expense request?")) return;
    try {
      const updatedExpense = mapExpense(await api.cancelExpense(selected.id));
      setRequests((current) => current.map((request) => request.id === updatedExpense.id ? updatedExpense : request));
    } catch (cancelError) {
      setError(cancelError.message || "Unable to cancel expense request.");
    }
  }

  async function handleFiles(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const files = await Promise.all(selectedFiles.map(async (file) => ({
      name: file.name,
      type: file.type.includes("pdf") ? "pdf" : "image",
      url: URL.createObjectURL(file),
      dataUrl: await readFileAsDataUrl(file),
    })));
    setForm((current) => ({ ...current, files: [...current.files, ...files] }));
    event.target.value = "";

    if (!selectedFiles.length) return;

    setExtractingReceipt(true);
    setError("");
    const extractedItems = [];
    let extractedHst = 0;
    const failedFiles = [];

    for (const receiptFile of selectedFiles) {
      try {
        const fileDataUrl = await prepareReceiptForAnalysis(receiptFile);
        const extraction = await api.extractExpenseReceipt(fileDataUrl);
        extractedItems.push(...extraction.items);
        extractedHst += Number(extraction.hst_amount) || 0;
      } catch (extractionError) {
        failedFiles.push(`${receiptFile.name}: ${extractionError.message || "Unable to analyze this file."}`);
      }
    }

    if (extractedItems.length || extractedHst > 0) {
      setForm((current) => {
        const existingItems = current.items.filter((item) => item.description.trim() || item.amount);
        return {
          ...current,
          items: [...existingItems, ...extractedItems].length ? [...existingItems, ...extractedItems] : current.items,
          hstAmount: extractedHst > 0 ? String((Number(current.hstAmount) || 0) + extractedHst) : current.hstAmount,
        };
      });
    }

    if (failedFiles.length) {
      setError(korean ? `영수증 분석 실패 - ${failedFiles.join("; ")}` : `Receipt analysis failed - ${failedFiles.join("; ")}`);
    }
    setExtractingReceipt(false);
  }

  async function createRequest() {
    if (!isFormComplete) return;
    setSubmitting(true);
    setError("");
    const payload = {
      request_date: form.date,
      title: form.title.trim(),
      memo: form.memo.trim(),
      hst_amount: hstAmount,
      first_approver_member_id: Number(form.firstApproverMemberId),
      second_approver_member_id: Number(form.secondApproverMemberId),
      items: form.items.map((item) => ({ description: item.description.trim(), amount: Number(item.amount) })),
      attachments: form.files.map(({ name, type, url = "", dataUrl = "" }) => ({ name, type, url, data_url: dataUrl })),
    };
    try {
      const savedExpense = mapExpense(editingId ? await api.updateExpense(editingId, payload) : await api.createExpense(payload));
      setRequests((current) => editingId ? current.map((request) => request.id === savedExpense.id ? savedExpense : request) : [savedExpense, ...current]);
      setSelectedId(savedExpense.id);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (saveError) {
      setError(saveError.message || "Unable to save expense request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>

        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog} sx={{ alignSelf: { xs: "flex-start", sm: "auto" }, bgcolor: "#3b522e", fontWeight: 700, textTransform: "none", px: 2, "&:hover": { bgcolor: "#2f4325" } }}>
          {korean ? "요청 생성" : "Create Request"}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(420px, 0.9fr) minmax(0, 1.1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #e8edf3" }}><Typography sx={{ fontWeight: 700, color: "#313b5e" }}>{korean ? "요청 목록" : "Request List"}</Typography></Box>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 400 }}>
              <TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}>
                {[korean ? "요청일" : "Date", korean ? "제목" : "Title", korean ? "진행 상태" : "Status", korean ? "금액" : "Amount"].map((label) => <TableCell key={label} sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>{displayedRequests.map((request) => <TableRow key={request.id} hover selected={request.id === selected.id} onClick={() => setSelectedId(request.id)} sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(59,82,46,0.08)" }, "&.Mui-selected:hover": { bgcolor: "rgba(59,82,46,0.12)" } }}>
                <TableCell sx={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDateTime(request.createdAt, korean)}</TableCell>
                <TableCell sx={{ minWidth: 145, fontSize: "13px", fontWeight: 600, color: "#313b5e" }}>{korean ? request.titleKo : request.title}</TableCell>
                <TableCell><Chip label={status(request.status)} size="small" sx={{ height: 23, fontSize: "11px", fontWeight: 700, bgcolor: request.status === "paid" ? "#e8f4ed" : request.status === "approved" ? "#e9f0ff" : "#fff4df", color: request.status === "paid" ? "#287448" : request.status === "approved" ? "#2756a5" : "#9a6500" }} /></TableCell>
                <TableCell align="right" sx={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(request.amount)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>
          {requests.length > 10 && <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: "1px solid #e8edf3" }}><Pagination count={pageCount} page={Math.min(page, pageCount)} onChange={(_, nextPage) => setPage(nextPage)} size="small" color="primary" /></Box>}
        </Paper>

        <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}>
          <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5, borderBottom: "1px solid #e8edf3" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}><Box><Typography sx={{ fontSize: "12px", color: "#5d7186", fontWeight: 700 }}>{selected.id} · {formatDateTime(selected.createdAt, korean)}</Typography><Typography variant="h6" sx={{ color: "#313b5e", fontWeight: 800, mt: 0.4 }}>{korean ? selected.titleKo : selected.title}</Typography></Box><Stack direction="row" spacing={1} alignItems="flex-start"><Chip label={hasSelectedExpense ? status(selected.status) : "-"} sx={{ fontWeight: 700, bgcolor: "#eef2f7", color: "#3b522e" }} /><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={openEditDialog} disabled={!hasSelectedExpense || selected.status !== "reviewing"} sx={{ textTransform: "none", borderColor: "#b8c5d1", color: "#3b522e" }}>{korean ? "수정" : "Edit"}</Button><Button size="small" variant="outlined" color="error" onClick={cancelRequest} disabled={!hasSelectedExpense || selected.status !== "reviewing"} sx={{ textTransform: "none" }}>{korean ? "요청 취소" : "Cancel Request"}</Button></Stack></Stack>
          </Box>
          <Stack spacing={3} sx={{ p: { xs: 2, sm: 3 } }}>
            <Box><Typography variant="subtitle2" sx={{ color: "#313b5e", fontWeight: 800, mb: 1 }}>{korean ? "세부 항목" : "Expense Items"}</Typography>
              <TableContainer><Table size="small"><TableHead><TableRow sx={{ bgcolor: "#f6f8fa" }}><TableCell sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186" }}>{korean ? "항목명" : "Item"}</TableCell><TableCell align="right" sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>{korean ? "금액" : "Amount"}</TableCell></TableRow></TableHead><TableBody>{selected.items.map((item, index) => <TableRow key={`${item.description}-${index}`}><TableCell sx={{ wordBreak: "break-word" }}>{korean ? item.descriptionKo : item.description}</TableCell><TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(item.amount)}</TableCell></TableRow>)}<TableRow><TableCell sx={{ fontWeight: 800 }}>{korean ? "HST" : "HST"}</TableCell><TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(selected.hstAmount)}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 800, color: "#313b5e" }}>{korean ? "총 비용" : "Total"}</TableCell><TableCell align="right" sx={{ fontWeight: 800, color: "#3b522e", fontSize: "17px", whiteSpace: "nowrap" }}>{formatCurrency(selected.amount)}</TableCell></TableRow></TableBody></Table></TableContainer>
            </Box>
            <Box><Typography variant="subtitle2" sx={{ color: "#313b5e", fontWeight: 800, mb: 0.8 }}>{korean ? "메모" : "Memo"}</Typography><Typography variant="body2" sx={{ color: "#536579", lineHeight: 1.7 }}>{selected.memo || "-"}</Typography></Box>
            <Box><Typography variant="subtitle2" sx={{ color: "#313b5e", fontWeight: 800, mb: 1 }}>{korean ? "첨부 파일" : "Attachments"}</Typography>{selected.attachments.length ? <Stack spacing={1.5}>{selected.attachments.map((file, index) => <Box key={`${file.name}-${index}`} sx={{ border: "1px solid #d8dfe7", borderRadius: "6px", overflow: "hidden" }}><Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1, py: 0.75, bgcolor: "#f6f8fa" }}>{file.type === "pdf" ? <DescriptionIcon fontSize="small" /> : <InsertDriveFileIcon fontSize="small" />}<Typography variant="caption" sx={{ fontWeight: 700 }}>{file.name}</Typography></Stack>{file.url && (file.type === "pdf" ? <Box component="iframe" src={file.url} title={file.name} sx={{ display: "block", border: 0, width: "100%", height: 440 }} /> : <Box component="img" src={file.url} alt={file.name} sx={{ display: "block", width: "100%", maxHeight: 520, objectFit: "contain", bgcolor: "#f6f8fa" }} />)}</Box>)}</Stack> : <Typography variant="body2" sx={{ color: "#8493a2" }}>{korean ? "첨부 파일 없음" : "No attachments"}</Typography>}</Box>
            <Box><Typography variant="subtitle2" sx={{ color: "#313b5e", fontWeight: 800, mb: 1.5 }}>{korean ? "승인 경로" : "Approval Path"}</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}>{selected.approvals.map((approval, index) => <Box key={approval.role} sx={{ flex: 1, position: "relative", pr: { sm: index < 2 ? 1 : 0 } }}><Box sx={{ p: 1.25, bgcolor: approval.state === "done" ? "#edf7f0" : approval.state === "current" ? "#fff6e7" : "#f5f7f9", border: "1px solid", borderColor: approval.state === "done" ? "#cce7d5" : approval.state === "current" ? "#f5d79d" : "#e4e8ed", borderRadius: "6px" }}><Typography sx={{ fontSize: "11px", color: "#5d7186", fontWeight: 700 }}>{korean ? approval.roleKo : approval.role}</Typography><Typography variant="body2" sx={{ fontWeight: 800, color: "#313b5e", mt: 0.25 }}>{approval.name}</Typography><Typography sx={{ fontSize: "11px", color: "#68788a", mt: 0.4 }}>{formatDateTime(approval.date, korean)}</Typography>{approval.comment && <Typography sx={{ fontSize: "12px", color: "#536579", mt: 0.8, whiteSpace: "pre-wrap" }}>{korean ? `의견: ${approval.comment}` : `Comment: ${approval.comment}`}</Typography>}</Box></Box>)}</Stack></Box>
          </Stack>
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: "#313b5e" }}>{editingId ? (korean ? "비용 요청 수정" : "Edit Expense Request") : (korean ? "비용 요청 생성" : "Create Expense Request")}</DialogTitle>
        <DialogContent dividers><Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField label={korean ? "제목" : "Title"} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} fullWidth required size="small" /><TextField label={korean ? "요청일" : "Request Date"} type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} InputLabelProps={{ shrink: true }} size="small" sx={{ minWidth: { sm: 180 } }} /></Stack>
          <FormControl fullWidth required size="small" disabled={loadingApprovalRoutes}>
            <InputLabel>{korean ? "결재 경로" : "Approval Route"}</InputLabel>
            <Select label={korean ? "결재 경로" : "Approval Route"} value={form.approvalRouteId} onChange={(event) => selectApprovalRoute(event.target.value)}>
              <MenuItem value=""><em>{korean ? "결재 경로를 선택하세요." : "Select an approval route."}</em></MenuItem>
              {approvalRoutes.map((route) => <MenuItem key={route.id} value={String(route.id)}>{route.account_code ? `${route.account_code} · ` : ""}{route.account_name || route.department_name} ({route.chairperson_name} → {route.finance_elder_name})</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth required size="small" disabled={loadingApprovers || Boolean(form.approvalRouteId)}>
              <InputLabel>{korean ? "1차 결재자" : "First Approver"}</InputLabel>
              <Select label={korean ? "1차 결재자" : "First Approver"} value={form.firstApproverMemberId} onChange={(event) => setForm((current) => ({ ...current, firstApproverMemberId: event.target.value }))}>
                {approvers.map((approver) => <MenuItem key={approver.id} value={String(approver.id)}>{approver.name}{approver.title ? ` (${approver.title})` : ""}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth required size="small" disabled={loadingApprovers || Boolean(form.approvalRouteId)}>
              <InputLabel>{korean ? "2차 결재자" : "Second Approver"}</InputLabel>
              <Select label={korean ? "2차 결재자" : "Second Approver"} value={form.secondApproverMemberId} onChange={(event) => setForm((current) => ({ ...current, secondApproverMemberId: event.target.value }))}>
                {approvers.map((approver) => <MenuItem key={approver.id} value={String(approver.id)}>{approver.name}{approver.title ? ` (${approver.title})` : ""}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Box><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 0.5 }}>{korean ? "영수증 및 첨부 파일" : "Receipts and Attachments"}</Typography><Typography variant="caption" sx={{ display: "block", color: "#5d7186", mb: 1 }}>{korean ? "사진 또는 PDF를 선택하면 즉시 분석하여 영수증의 항목, 금액 및 HST를 자동으로 추가합니다." : "Selecting a receipt image or PDF analyzes it immediately and adds detected items, amounts, and HST."}</Typography><input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={handleFiles} /><Button variant="outlined" startIcon={extractingReceipt ? <CircularProgress size={16} color="inherit" /> : <AttachFileIcon />} onClick={() => inputRef.current?.click()} disabled={extractingReceipt} sx={{ textTransform: "none", borderColor: "#b8c5d1", color: "#3b522e" }}>{extractingReceipt ? (korean ? "항목 분석 중..." : "Analyzing receipt...") : (korean ? "사진 또는 PDF 첨부" : "Attach photo or PDF")}</Button>{extractingReceipt && <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "#5d7186", fontWeight: 700 }}>{korean ? "영수증에서 비용 항목과 HST를 추출하는 중입니다. 잠시만 기다려주세요." : "Extracting expense items and HST from the receipt. Please wait."}</Typography>}<Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>{form.files.map((file, index) => <Chip key={`${file.name}-${index}`} label={file.name} onDelete={() => setForm((current) => ({ ...current, files: current.files.filter((_, fileIndex) => fileIndex !== index) }))} size="small" />)}</Stack></Box>
          <Box><Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e" }}>{korean ? "비용 항목" : "Expense Items"}</Typography><Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setForm((current) => ({ ...current, items: [...current.items, { description: "", amount: "" }] }))} sx={{ ml: "auto", textTransform: "none", bgcolor: "#3b522e", fontWeight: 700, "&:hover": { bgcolor: "#2f4325" } }}>{korean ? "항목 추가" : "Add item"}</Button></Stack><Stack spacing={1}>{form.items.map((item, index) => <Stack key={index} direction="row" spacing={1}><TextField label={korean ? "항목명" : "Item"} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} fullWidth required size="small" /><TextField label={korean ? "금액 (CAD)" : "Amount (CAD)"} type="number" value={item.amount} onChange={(event) => updateItem(index, "amount", event.target.value)} required size="small" sx={{ width: 160 }} />{form.items.length > 1 && <IconButton aria-label="Remove item" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><CloseIcon /></IconButton>}</Stack>)}</Stack><Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={2} alignItems={{ sm: "center" }} sx={{ mt: 1 }}><TextField label="HST (CAD)" type="number" value={form.hstAmount} onChange={(event) => setForm((current) => ({ ...current, hstAmount: event.target.value }))} size="small" sx={{ width: { xs: "100%", sm: 160 } }} inputProps={{ min: 0, step: "0.01" }} /><Typography align="right" sx={{ fontWeight: 800, color: "#3b522e" }}>{korean ? "총 비용" : "Total"}: {formatCurrency(totalWithHst)}</Typography></Stack></Box>
          <TextField label={korean ? "메모" : "Memo"} value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} multiline rows={3} fullWidth required size="small" />
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={() => setDialogOpen(false)} disabled={submitting} sx={{ color: "#5d7186", textTransform: "none" }}>{korean ? "취소" : "Cancel"}</Button><Button variant="contained" onClick={createRequest} disabled={!isFormComplete || submitting} startIcon={<ReceiptLongIcon />} sx={{ bgcolor: "#3b522e", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#2f4325" } }}>{submitting ? (korean ? "저장 중..." : "Saving...") : editingId ? (korean ? "수정 저장" : "Save Changes") : (korean ? "요청 제출" : "Submit Request")}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}