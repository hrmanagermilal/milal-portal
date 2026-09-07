import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { api } from "../../api";
import DataMart from "../../common/DataMart";
import { useLanguage } from "../../lang/LanguageContext";
import ExpenseApprovalList from "./ExpenseApprovalList";
import ExpenseApprovalDetail from "./ExpenseApprovalDetail";

export default function ExpenseApproval({ initialExpenseId = null, onApprovalChanged }) {
  const { lang, t } = useLanguage();
  const korean = lang === "ko";
  const [filter, setFilter] = useState("first_approve");
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
  const [filterCounts, setFilterCounts] = useState({});

  const selected = requests.find((request) => request.id === selectedId) || null;
  const currentApprovalIndex = selected?.approvals?.findIndex((approval) => approval.state === "current") ?? -1;
  const currentApprovalEntry = currentApprovalIndex >= 0 ? selected.approvals[currentApprovalIndex] : null;
  const hasPendingApproval = Boolean(currentApprovalEntry);
  const currentMemberId = DataMart.getCurrentUser()?.member_id;
  const isMyTurn = Boolean(currentApprovalEntry && currentMemberId && currentApprovalEntry.member_id === currentMemberId);
  const isFirstApprovalStep = currentApprovalIndex === 1;
  const statusLabel = (status) => ({
    first_approve: t("expenseFirstApproval"),
    second_approve: t("expenseSecondApproval"),
    reviewing: t("expenseReviewed"),
    rejected: t("statusRejected"),
    paid: t("expensePaid"),
    first_agreed: t("expenseFirstAgreement"),
    second_agreed: t("expenseSecondAgreement"),
  })[status] || status;
  const statusChipSx = (status) => ({
    fontSize: "11px",
    bgcolor: status === "paid" ? "#e8f5ed" : status === "first_approve" || status === "second_approve" || status === "reviewing" || status === "second_agreed" ? "#e9f0ff" : status === "rejected" ? "#fdeaea" : status === "first_agreed" ? "#e8f3ff" : "#fff4df",
    color: status === "paid" ? "#226a43" : status === "first_approve" || status === "second_approve" || status === "reviewing" || status === "second_agreed" ? "#2756a5" : status === "rejected" ? "#b23737" : status === "first_agreed" ? "#1976d2" : "#9a6500",
  });

  async function loadRequests(activeFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getExpenseApprovals(activeFilter);
      console.log(data);
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

  async function loadFilterCounts() {
    try {
      const FILTERS = ["", "first_approve", "second_approve", "reviewing", "first_agreed", "second_agreed", "paid", "rejected"];
      const counts = {};
      const currentMemberId = DataMart.getCurrentUser()?.member_id;
      
      for (const f of FILTERS) {
        try {
          const data = await api.getExpenseApprovals(f);
          // 내가 처리해야 하는 항목만 카운트 (현재 내 차례인 항목)
          const myItems = data?.filter(item => {
            const currentApprovalIndex = item?.approvals?.findIndex((approval) => approval.state === "current") ?? -1;
            const currentApprovalEntry = currentApprovalIndex >= 0 ? item.approvals[currentApprovalIndex] : null;
            return currentApprovalEntry && currentMemberId && currentApprovalEntry.member_id === currentMemberId;
          }) || [];
          counts[f || "all"] = myItems.length;
        } catch {
          counts[f || "all"] = 0;
        }
      }
      setFilterCounts(counts);
    } catch (err) {
      console.error("Failed to load filter counts:", err);
    }
  }

  useEffect(() => {
    loadRequests();
    loadFilterCounts();
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
    const prompt = action === "approve" ? t("expenseApprovalConfirmApprove") : t("expenseApprovalConfirmReject");
    if (!window.confirm(prompt)) return;

    setProcessing(true);
    setError("");
    try {
      await api.decideExpenseApproval(selected.id, action, comment.trim(), Number(accountId) || null, isFirstApprovalStep ? Number(secondApproverId) || null : null);
      await loadRequests();
      await loadFilterCounts();
      onApprovalChanged?.();
    } catch (decisionError) {
      setError(decisionError.message || "Unable to process this expense request.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Box>
      <ExpenseApprovalList
        requests={requests}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        filter={filter}
        setFilter={setFilter}
        page={page}
        setPage={setPage}
        loading={loading}
        error={error}
        statusLabel={statusLabel}
        statusChipSx={statusChipSx}
        filterCounts={filterCounts}
      />
      <ExpenseApprovalDetail
        selected={selected}
        isMyTurn={isMyTurn}
        hasPendingApproval={hasPendingApproval}
        isFirstApprovalStep={isFirstApprovalStep}
        currentApprovalIndex={currentApprovalIndex}
        accounts={accounts}
        approvers={approvers}
        accountId={accountId}
        setAccountId={setAccountId}
        secondApproverId={secondApproverId}
        setSecondApproverId={setSecondApproverId}
        comment={comment}
        setComment={setComment}
        processing={processing}
        onApprove={() => decide("approve")}
        onReject={() => decide("reject")}
        statusLabel={statusLabel}
      />
    </Box>
  );
}