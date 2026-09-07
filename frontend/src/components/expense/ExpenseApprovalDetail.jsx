import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
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
                    onClick={() => file.url && setPreviewFile(file)}
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
                    disabled={!isMyTurn || processing || !comment.trim() || !accountId || (isFirstApprovalStep && !secondApproverId)}
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
          {previewFile?.name}
          <Button
            component="a"
            href={previewFile?.url}
            target="_blank"
            rel="noreferrer"
            startIcon={<OpenInNewIcon />}
            sx={{ ml: "auto", textTransform: "none" }}
          >
            {t("expenseOpenInNewWindow")}
          </Button>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: "#f6f8fa" }}>
          {previewFile?.type === "pdf" ? (
            <Box component="iframe" src={previewFile.url} title={previewFile.name} sx={{ display: "block", border: 0, width: "100%", height: "75vh" }} />
          ) : (
            <Box component="img" src={previewFile?.url} alt={previewFile?.name} sx={{ display: "block", width: "100%", height: "75vh", objectFit: "contain" }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
