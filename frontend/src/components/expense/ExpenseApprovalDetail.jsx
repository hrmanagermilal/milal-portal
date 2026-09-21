import { useRef, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useLanguage } from "../../lang/LanguageContext";

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

export default function ExpenseApprovalDetail({
  selected,
  isMyTurn,
  hasPendingApproval,
  isFirstApprovalStep,
  currentApprovalIndex,
  accounts,
  approvers,
  accountId,
  setAccountId,
  secondApproverId,
  setSecondApproverId,
  isFirstConcurrenceStep,
  chequeNumber,
  setChequeNumber,
  approvalNumber,
  setApprovalNumber,
  comment,
  setComment,
  processing,
  onApprove,
  onReject,
  statusLabel,
}) {
  const { lang, t } = useLanguage();
  const korean = lang === "ko";
  const [previewFile, setPreviewFile] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const previewViewportRef = useRef(null);
  const dragStartRef = useRef(null);

  function openPreview(file) {
    setPreviewScale(1);
    setPreviewFile(file);
  }

  function changePreviewScale(nextScale) {
    setPreviewScale(Math.min(4, Math.max(1, nextScale)));
  }

  function handlePreviewPointerDown(event) {
    if (previewFile?.type === "pdf" || event.button !== 0) return;
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDraggingPreview(true);
  }

  function handlePreviewPointerMove(event) {
    const viewport = previewViewportRef.current;
    const dragStart = dragStartRef.current;
    if (!viewport || !dragStart) return;
    viewport.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.x);
    viewport.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.y);
  }

  function handlePreviewPointerUp(event) {
    dragStartRef.current = null;
    if (previewViewportRef.current?.hasPointerCapture(event.pointerId)) {
      previewViewportRef.current.releasePointerCapture(event.pointerId);
    }
    setIsDraggingPreview(false);
  }

  const formatCurrency = (amount) => `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", minHeight: 360 }}>
        {selected ? (
          <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Header with Title and Status */}
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontSize: "12px", color: "#5d7186", fontWeight: 700 }}>
                  {formatDateTime(selected.created_at, korean)} · {selected.requester_name}
                </Typography>
                <Typography variant="h6" sx={{ color: "#313b5e", fontWeight: 800, mt: 0.5 }}>
                  {selected.title}
                </Typography>
              </Box>
              <Chip label={statusLabel(selected.status)} sx={{ alignSelf: "flex-start", fontWeight: 700, bgcolor: "#eef2f7", color: "#3b522e" }} />
            </Stack>

            <Divider />

            {(selected.cheque_number || selected.approval_number) && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label={t("expenseChequeNumber")} value={selected.cheque_number || "-"} size="small" fullWidth InputProps={{ readOnly: true }} />
                <TextField label={t("expenseApprovalNumber")} value={selected.approval_number || "-"} size="small" fullWidth InputProps={{ readOnly: true }} />
              </Stack>
            )}

            {/* Expense Items */}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 1 }}>
                {t("expenseExpenseItems")}
              </Typography>
              <TableContainer sx={{ width: "100%", overflowX: "hidden" }}>
                <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f6f8fa" }}>
                      <TableCell sx={{ fontSize: "12px", fontWeight: 700, color: "#5d7186" }}>
                        {t("expenseItemName")}
                      </TableCell>
                      <TableCell align="right" sx={{ width: 128, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>
                        {t("expenseAmount")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selected.items.map((item, index) => (
                      <TableRow key={`${item.description}-${index}`}>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>{item.description}</TableCell>
                        <TableCell align="right" sx={{ width: 128, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>{t("expenseHst")}</TableCell>
                      <TableCell align="right" sx={{ width: 128, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {formatCurrency(selected.hst_amount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: "#313b5e" }}>{t("expenseTotal")}</TableCell>
                      <TableCell align="right" sx={{ width: 128, fontWeight: 800, color: "#3b522e", fontSize: "17px", whiteSpace: "nowrap" }}>
                        {formatCurrency(selected.total_amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Memo */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 0.75 }}>
                {t("expenseMemo")}
              </Typography>
              <Typography variant="body2" sx={{ color: "#536579" }}>
                {selected.memo}
              </Typography>
            </Box>

            {/* Attachments */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 0.75 }}>
                {t("expenseAttachments")}
              </Typography>
              <Stack spacing={1.5}>
                {selected.attachments.map((file, index) => (
                  <Box
                    key={`${file.name}-${index}`}
                    onClick={() => file.url && openPreview(file)}
                    sx={{
                      border: "1px solid #d8dfe7",
                      borderRadius: "6px",
                      overflow: "hidden",
                      cursor: file.url ? "zoom-in" : "default",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1, py: 0.75, bgcolor: "#f6f8fa" }}>
                      {file.type === "pdf" ? <DescriptionIcon fontSize="small" /> : <InsertDriveFileIcon fontSize="small" />}
                      <Typography variant="caption" sx={{ fontWeight: 700, flexGrow: 1 }}>
                        {file.name}
                      </Typography>
                      {file.url && <OpenInNewIcon fontSize="small" sx={{ color: "#5d7186" }} />}
                    </Stack>
                    {file.url &&
                      (file.type === "pdf" ? (
                        <Box
                          component="iframe"
                          src={file.url}
                          title={file.name}
                          sx={{ display: "block", border: 0, width: "100%", height: 440, pointerEvents: "none" }}
                        />
                      ) : (
                        <Box
                          component="img"
                          src={file.url}
                          alt={file.name}
                          sx={{ display: "block", width: "100%", maxHeight: 520, objectFit: "contain", bgcolor: "#f6f8fa" }}
                        />
                      ))}
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Approval Comments */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#313b5e", mb: 1 }}>
                {t("expenseApprovalComments")}
              </Typography>
              <Stack spacing={1}>
                {selected.approvals.map((approval, index) => (
                  <Box
                    key={`${approval.member_id || approval.role}-${index}`}
                    sx={{
                      borderLeft: "3px solid",
                      borderColor: approval.state === "rejected" ? "#c34a4a" : approval.state === "done" ? "#4d8c62" : "#c6d0db",
                      pl: 1.25,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#313b5e" }}>
                        {korean ? approval.roleKo : approval.role} · {approval.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#68788a", whiteSpace: "nowrap" }}>
                        {formatDateTime(approval.date, korean)}
                      </Typography>
                    </Stack>
                    {approval.comment && (
                      <Typography variant="body2" sx={{ color: "#536579", mt: 0.5, whiteSpace: "pre-wrap" }}>
                        {approval.comment}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Approval Action Section */}
            {hasPendingApproval && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControl fullWidth required size="small" disabled={!isMyTurn}>
                    <InputLabel>{t("expenseApprovalAccount")}</InputLabel>
                    <Select label={t("expenseApprovalAccount")} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                      {accounts.map((account) => (
                        <MenuItem key={account.id} value={String(account.id)}>
                          {account.account_code} · {account.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {isFirstApprovalStep && (
                    <FormControl fullWidth required size="small" disabled={!isMyTurn}>
                      <InputLabel>{t("expenseApprovalSecondApprover")}</InputLabel>
                      <Select label={t("expenseApprovalSecondApprover")} value={secondApproverId} onChange={(event) => setSecondApproverId(event.target.value)}>
                        {approvers.map((approver) => (
                          <MenuItem key={approver.id} value={String(approver.id)}>
                            {approver.name}
                            {approver.title ? ` (${approver.title})` : ""}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>
                {isFirstConcurrenceStep && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label={t("expenseChequeNumber")}
                      value={chequeNumber}
                      onChange={(event) => setChequeNumber(event.target.value)}
                      required
                      fullWidth
                      size="small"
                      disabled={!isMyTurn}
                      inputProps={{ maxLength: 100 }}
                    />
                    <TextField
                      label={t("expenseApprovalNumber")}
                      value={approvalNumber}
                      onChange={(event) => setApprovalNumber(event.target.value)}
                      required
                      fullWidth
                      size="small"
                      disabled={!isMyTurn}
                      inputProps={{ maxLength: 100 }}
                    />
                  </Stack>
                )}
                <TextField
                  label={t("expenseComment")}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  multiline
                  rows={3}
                  required
                  fullWidth
                  disabled={!isMyTurn}
                  placeholder={t("expenseCommentPlaceholder")}
                />
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    disabled={!isMyTurn || processing || !comment.trim()}
                    onClick={onReject}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    {t("expenseReject")}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CheckIcon />}
                    disabled={!isMyTurn || processing || !comment.trim() || !accountId || (isFirstApprovalStep && !secondApproverId) || (isFirstConcurrenceStep && (!chequeNumber.trim() || !approvalNumber.trim()))}
                    onClick={onApprove}
                    sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#3b522e", "&:hover": { bgcolor: "#2f4325" } }}
                  >
                    {t("expenseApprove")}
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        ) : (
          <Box sx={{ minHeight: 360, display: "grid", placeItems: "center", color: "#8493a2" }}>
            <Typography>{t("expenseSelectApprovalRequest")}</Typography>
          </Box>
        )}
      </Paper>

      {/* Image/PDF Preview Dialog */}
      <Dialog open={Boolean(previewFile)} onClose={() => setPreviewFile(null)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{previewFile?.name}</Typography>
          {previewFile?.type !== "pdf" && <Stack direction="row" spacing={0.25} sx={{ ml: "auto" }}>
            <Button aria-label="축소" title="축소" onClick={() => changePreviewScale(previewScale - 0.5)} disabled={previewScale <= 1} sx={{ minWidth: 36, px: 0 }}><ZoomOutIcon /></Button>
            <Typography sx={{ minWidth: 48, alignSelf: "center", textAlign: "center", fontSize: "12px", fontWeight: 700 }}>{Math.round(previewScale * 100)}%</Typography>
            <Button aria-label="확대" title="확대" onClick={() => changePreviewScale(previewScale + 0.5)} disabled={previewScale >= 4} sx={{ minWidth: 36, px: 0 }}><ZoomInIcon /></Button>
            <Button aria-label="원본 크기로 복원" title="원본 크기로 복원" onClick={() => changePreviewScale(1)} disabled={previewScale === 1} sx={{ minWidth: 36, px: 0 }}><RestartAltIcon /></Button>
          </Stack>}
          <Button
            component="a"
            href={previewFile?.url}
            target="_blank"
            rel="noreferrer"
            startIcon={<OpenInNewIcon />}
            sx={{ ml: previewFile?.type === "pdf" ? "auto" : 1, textTransform: "none", whiteSpace: "nowrap" }}
          >
            {t("expenseOpenInNewWindow")}
          </Button>
        </DialogTitle>
        <DialogContent
          ref={previewViewportRef}
          dividers
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerUp}
          sx={{
            p: 0,
            height: "75vh",
            overflow: "auto",
            bgcolor: "#f6f8fa",
            cursor: previewFile?.type === "pdf" ? "default" : isDraggingPreview ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {previewFile?.type === "pdf" ? (
            <Box component="iframe" src={previewFile.url} title={previewFile.name} sx={{ display: "block", border: 0, width: "100%", height: "75vh" }} />
          ) : (
            <Box
              sx={{
                width: `${previewScale * 100}%`,
                height: `${previewScale * 75}vh`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Box component="img" draggable={false} src={previewFile?.url} alt={previewFile?.name} sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
