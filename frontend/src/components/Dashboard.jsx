import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

const panelSx = {
  border: "1px solid #dce4ee",
  borderRadius: "8px",
  boxShadow: "none",
  overflow: "hidden",
};

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function isToday(value) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function DashboardSection({ title, icon, actionLabel, onAction, children }) {
  return (
    <Paper sx={panelSx}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.25, py: 1.5, bgcolor: "#f7f9fb" }}>
        <Box sx={{ color: "#3b522e", display: "flex" }}>{icon}</Box>
        <Typography sx={{ flexGrow: 1, color: "#313b5e", fontSize: "15px", fontWeight: 800 }}>{title}</Typography>
        {onAction && <Button size="small" onClick={onAction} sx={{ color: "#3b522e", fontWeight: 700, minWidth: 0 }}>{actionLabel}</Button>}
      </Stack>
      <Divider />
      {children}
    </Paper>
  );
}

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  children: PropTypes.node.isRequired,
};

function EmptyState({ children }) {
  return <Typography sx={{ px: 2.25, py: 3, color: "#758296", fontSize: "14px" }}>{children}</Typography>;
}

EmptyState.propTypes = { children: PropTypes.node.isRequired };

function ReservationRows({ reservations, showRequester = false, emptyLabel }) {
  const { t } = useLanguage();
  if (!reservations.length) return <EmptyState>{emptyLabel}</EmptyState>;

  return (
    <Stack divider={<Divider flexItem />}>
      {reservations.map((reservation) => (
        <Box key={reservation.id} sx={{ px: 2.25, py: 1.35 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography noWrap sx={{ flexGrow: 1, color: "#313b5e", fontSize: "14px", fontWeight: 700 }}>{reservation.room_name}</Typography>
            <Typography sx={{ color: "#758296", fontSize: "12px" }}>{formatDateTime(reservation.start_time)}</Typography>
          </Stack>
          <Typography noWrap sx={{ mt: 0.35, color: "#758296", fontSize: "13px" }}>
            {showRequester ? `${reservation.requester_name} · ${reservation.purpose}` : reservation.purpose}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

ReservationRows.propTypes = {
  reservations: PropTypes.array.isRequired,
  showRequester: PropTypes.bool,
  emptyLabel: PropTypes.string.isRequired,
};

export default function Dashboard({ userName, userPermission, reservations, canApproveExpenses, onTabChange }) {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [approvalExpenses, setApprovalExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const requests = [api.getExpenses()];
    if (canApproveExpenses) requests.push(api.getExpenseApprovals());
    Promise.all(requests)
      .then(([expenseData, approvalData = []]) => {
        if (!active) return;
        setExpenses(expenseData);
        setApprovalExpenses(approvalData.filter((expense) => ["reviewing", "approved"].includes(expense.status)));
      })
      .catch(() => {
        if (!active) return;
        setExpenses([]);
        setApprovalExpenses([]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canApproveExpenses]);

  const myReservations = reservations.filter((item) => item.requester_name === userName && !item.external).sort((left, right) => new Date(left.start_time) - new Date(right.start_time)).slice(0, 5);
  const pendingReservations = reservations.filter((item) => item.status === "pending");
  const todayReservations = reservations.filter((item) => !item.external && isToday(item.start_time)).sort((left, right) => new Date(left.start_time) - new Date(right.start_time));
  const openExpenseCount = expenses.filter((expense) => ["reviewing", "approved"].includes(expense.status)).length;

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 2 }}>
        <DashboardSection title={t("dashboardMyReservations")} icon={<CalendarMonthIcon />} actionLabel={t("dashboardViewAll")} onAction={() => onTabChange("timeline")}>
          <ReservationRows reservations={myReservations} emptyLabel={t("dashboardNoReservations")} />
        </DashboardSection>

        <Stack spacing={2}>
          <DashboardSection title={t("dashboardExpenseRequests")} icon={<ReceiptLongIcon />} actionLabel={t("dashboardViewAll")} onAction={() => onTabChange("expense")}>
            {loading ? <Box sx={{ px: 2.25, py: 3 }}><CircularProgress size={20} /></Box> : <Box sx={{ px: 2.25, py: 2 }}><Typography sx={{ color: "#313b5e", fontSize: "28px", fontWeight: 800 }}>{openExpenseCount}</Typography><Typography sx={{ color: "#758296", fontSize: "13px" }}>{t("dashboardOpenExpenseRequests")}</Typography></Box>}
          </DashboardSection>

          {canApproveExpenses && <DashboardSection title={t("dashboardExpenseApprovals")} icon={<TaskAltIcon />} actionLabel={t("dashboardReview")} onAction={() => onTabChange("expense-approval")}>
            {loading ? <Box sx={{ px: 2.25, py: 3 }}><CircularProgress size={20} /></Box> : approvalExpenses.length === 0 ? <EmptyState>{t("dashboardNoExpenseApprovals")}</EmptyState> : <Stack divider={<Divider flexItem />}>{approvalExpenses.slice(0, 3).map((expense) => <Box key={expense.id} sx={{ px: 2.25, py: 1.25 }}><Typography noWrap sx={{ color: "#313b5e", fontSize: "14px", fontWeight: 700 }}>{expense.title}</Typography><Typography sx={{ mt: 0.3, color: "#758296", fontSize: "13px" }}>{expense.requester_name} · CAD {Number(expense.total_amount).toLocaleString()}</Typography></Box>)}</Stack>}
          </DashboardSection>}

          {userPermission === "admin" && <>
            <DashboardSection title={t("dashboardTodayReservations")} icon={<CalendarMonthIcon />} actionLabel={t("dashboardViewAll")} onAction={() => onTabChange("timeline")}>
              <ReservationRows reservations={todayReservations.slice(0, 5)} showRequester emptyLabel={t("dashboardNoTodayReservations")} />
            </DashboardSection>
            <DashboardSection title={t("dashboardReservationApprovals")} icon={<PendingActionsIcon />} actionLabel={t("dashboardReview")} onAction={() => onTabChange("admin")}>
              <Box sx={{ px: 2.25, py: 2 }}><Typography sx={{ color: "#313b5e", fontSize: "28px", fontWeight: 800 }}>{pendingReservations.length}</Typography><Typography sx={{ color: "#758296", fontSize: "13px" }}>{t("dashboardPendingReservations")}</Typography></Box>
            </DashboardSection>
          </>}
        </Stack>
      </Box>
    </Box>
  );
}

Dashboard.propTypes = {
  userName: PropTypes.string.isRequired,
  userPermission: PropTypes.string.isRequired,
  reservations: PropTypes.array.isRequired,
  canApproveExpenses: PropTypes.bool.isRequired,
  onTabChange: PropTypes.func.isRequired,
};