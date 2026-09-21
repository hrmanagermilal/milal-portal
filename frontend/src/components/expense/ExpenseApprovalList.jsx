import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
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
  Badge,
} from "@mui/material";
import { useLanguage } from "../../lang/LanguageContext";

const FILTERS = ["", "first_approve", "second_approve", "reviewing", "first_agreed", "second_agreed", "paid", "rejected"];

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

export default function ExpenseApprovalList({
  requests,
  selectedId,
  setSelectedId,
  filter,
  setFilter,
  page,
  setPage,
  loading,
  error,
  statusLabel,
  statusChipSx,
  filterCounts = {},
  searchQuery,
  setSearchQuery,
}) {
  const { lang, t } = useLanguage();
  const korean = lang === "ko";

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredRequests = normalizedSearch
    ? requests.filter((request) => [request.title, request.requester_name, request.cheque_number, request.approval_number]
      .some((value) => String(value || "").toLocaleLowerCase().includes(normalizedSearch)))
    : requests;
  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / 10));
  const displayedRequests = filteredRequests.slice((page - 1) * 10, page * 10);
  const formatCurrency = (amount) => `CAD ${Number(amount || 0).toLocaleString(korean ? "ko-KR" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
        {FILTERS.map((value) => {
          const count = filterCounts[value || "all"] || 0;
          // 처리 가능한 상태: "", "first_approve", "second_approve", "reviewing", "first_agreed", "second_agreed"
          // 읽기 전용: "paid", "rejected"
          const shouldShowBadge = value !== "" && value !== "paid" && value !== "rejected" && count > 0;
          
          return (
            <Badge
              key={value || "all"}
              badgeContent={shouldShowBadge ? count : null}
              color="error"
              sx={{
                "& .MuiBadge-badge": {
                  backgroundColor: "#d32f2f",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "11px",
                  minWidth: "20px",
                  height: "20px",
                  padding: "0 4px",
                  borderRadius: "10px",
                },
              }}
            >
              <Button
                variant={filter === value ? "contained" : "outlined"}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  color: filter === value ? "white" : "#3b522e",
                  bgcolor: filter === value ? "#3b522e" : "white",
                  borderColor: "#b8c5d1",
                  "&:hover": {
                    bgcolor: filter === value ? "#2f4325" : "#f3f7f1",
                  },
                }}
              >
                {value ? statusLabel(value) : t("expenseFilterAll")}
              </Button>
            </Badge>
          );
        })}
      </Stack>

      <TextField
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setPage(1);
        }}
        placeholder={t("expenseApprovalSearchPlaceholder")}
        size="small"
        fullWidth
        inputProps={{ maxLength: 100 }}
      />

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Paper elevation={0} sx={{ border: "1px solid #e0e6ef", borderRadius: "8px", overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "hidden" }}>
          <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f6f8fa" }}>
                <TableCell sx={{ width: { xs: "42%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186" }}>
                  {t("expenseTitle")}
                </TableCell>
                <TableCell sx={{ width: { xs: "30%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>
                  {t("expenseRequester")}
                </TableCell>
                <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>
                  {t("expenseTotal")}
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>
                  {t("expenseRequestDate")}
                </TableCell>
                <TableCell sx={{ width: { xs: "28%", sm: "auto" }, fontSize: "12px", fontWeight: 700, color: "#5d7186", whiteSpace: "nowrap" }}>
                  {t("expenseStatus")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: "#8493a2" }}>
                    {t("expenseNoApprovalRequests")}
                  </TableCell>
                </TableRow>
              ) : (
                displayedRequests.map((request) => (
                  <TableRow
                    key={request.id}
                    hover
                    selected={selectedId === request.id}
                    onClick={() => setSelectedId(request.id)}
                    sx={{
                      cursor: "pointer",
                      "&.Mui-selected": {
                        bgcolor: "rgba(59,82,46,0.08)",
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, color: "#313b5e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {request.title}
                    </TableCell>
                    <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {request.requester_name}
                    </TableCell>
                    <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap", fontWeight: 700 }}>
                      {formatCurrency(request.total_amount)}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "nowrap" }}>
                      {formatDateTime(request.created_at, korean)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {(() => {
                        // 현재 진행 중인 단계를 찾기
                        const currentApprovalIndex = request?.approvals?.findIndex((approval) => approval.state === "current") ?? -1;
                        const currentApprovalEntry = currentApprovalIndex >= 0 ? request.approvals[currentApprovalIndex] : null;
                        
                        // 현재 진행 중인 단계가 있으면 그것을 표시, 없으면 status를 표시
                        const displayStatus = currentApprovalEntry ? (() => {
                          const stageStatusMap = {
                            1: "first_approve",
                            2: "second_approve",
                            3: "reviewing",
                            4: "first_agreed",
                            5: "second_agreed",
                          };
                          return stageStatusMap[currentApprovalIndex] || request.status;
                        })() : request.status;
                        
                        return <Chip label={statusLabel(displayStatus)} size="small" sx={statusChipSx(displayStatus)} />;
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {filteredRequests.length > 10 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: "1px solid #e8edf3" }}>
            <Pagination
              count={pageCount}
              page={Math.min(page, pageCount)}
              onChange={(_, nextPage) => setPage(nextPage)}
              size="small"
              color="primary"
            />
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
