import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { api } from "./api";
import DataMart from "./common/DataMart";
import AdminReservationPanel from "./components/room-reservation/AdminReservationPanel";
import UserManagement from "./components/UserManagement";
import LoginModal from "./components/LoginModal";
import ReservationRequestForm from "./components/room-reservation/ReservationRequestForm";
import MultiRoomReservationRequestForm from "./components/room-reservation/MultiRoomReservationRequestForm";
import ReservationTimeline from "./components/room-reservation/ReservationTimeline";
import RoomSettingsPanel from "./components/room-reservation/RoomSettingsPanel";
import CellGroupInfoModal from "./components/cell_group/CellGroupInfoModal";
import CellReportPanel from "./components/cell_group/CellReportPanel";
import AdminSearchMembers from "./components/AdminSearchMembers";
import ExpensePanel from "./components/expense/ExpensePanel";
import ExpenseApproval from "./components/expense/ExpenseApproval";
import ExpenseAccountManagement from "./components/expense/ExpenseAccountManagement";
import ExpenseApprovalRouteManagement from "./components/expense/ExpenseApprovalRouteManagement";
import ExpenseAccountDetail from "./components/expense/ExpenseAccountDetail";
import Dashboard from "./components/Dashboard";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChatWidget from "./components/ChatWidget";
import { useLanguage } from "./i18n/LanguageContext";
import EventPublisher from "./event/EventPublisher";
import {EventDef} from "./event/EventDef";
import { dateToLocalISOString, localISOStringToUTCISO } from "./utils/datetime";

// Bottom nav SVG icons
const NavIconTimeline = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const NavIconRequest = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const NavIconAdmin = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
const NavIconSettings = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>;

function defaultTimes() {
  const now = new Date();
  // Round up to next whole hour
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const start = dateToLocalISOString(now);
  const end = dateToLocalISOString(new Date(now.getTime() + 3600000));
  return { start_time: start, end_time: end };
}

export default function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useLanguage();
  const expenseLink = new URLSearchParams(window.location.search);
  const linkedExpenseId = expenseLink.get("expenseId");
  const linkedExpenseTab = expenseLink.get("tab");

  const getPageSubtitle = () => {
    switch (tab) {
      case "cell-group":
        return t("cellGroupGuideText");
      case "cell-report":
        return t("cellReportGuideText");
      case "expense":
        return t("expenseGuideText");
      case "expense-approval":
        return t("expenseApprovalGuideText");
      case "expense-account-management":
        return t("navExpenseAccountManagement");
      default:
        return t("appSubtitle");
    }
  };

  const TABS = [
    { key: "dashboard", label: t("dashboardTitle") },
    { key: "timeline", label: t("navTimeline") },
    { key: "request",  label: t("navRequest") },
    { key: "multi-request", label: t("navMultiRequest") },
    { key: "admin",    label: t("navAdmin") },
    { key: "member-search", label: "🔍 성도 검색" },
    { key: "space-settings", label: t("navSettings") },
    { key: "cell-group", label: t("navCellGroupInfo") },
    { key: "cell-report", label: t("navCellReport") },
    { key: "expense", label: t("navExpense") },
    { key: "expense-approval", label: t("navExpenseApproval") },
    { key: "expense-account-management", label: t("navExpenseAccountManagement") },
    { key: "expense-approval-route-management", label: t("navExpenseApprovalRouteManagement") },
    { key: "expense-account-detail", label: t("navExpenseAccountManagement") },
  ];

  const [tab, setTab] = useState(() => linkedExpenseTab === "expense" || linkedExpenseTab === "expense-approval" ? linkedExpenseTab : "dashboard");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canApproveExpenses, setCanApproveExpenses] = useState(false);
  const [expenseApprovalCount, setExpenseApprovalCount] = useState(0);
  const [expenseAccountDetailId, setExpenseAccountDetailId] = useState(null);

  const [userName, setUserName] = useState(() => sessionStorage.getItem("milal_user") || "");
  const [userPermission, setUserPermission] = useState(() => sessionStorage.getItem("milal_permission") || "member");
  const [userTitle, setUserTitle] = useState(() => sessionStorage.getItem("milal_title") || "");
  const [userCellGroup, setUserCellGroup] = useState(() => sessionStorage.getItem("milal_cell_group") || "");

  function handleLogin(name, permission, title, cellGroup, fullUserInfo) {
    sessionStorage.setItem("milal_user", name);
    sessionStorage.setItem("milal_permission", permission);
    sessionStorage.setItem("milal_title", title || "");
    sessionStorage.setItem("milal_cell_group", cellGroup || "");
    setUserName(name);
    setUserPermission(permission);
    setUserTitle(title || "");
    setUserCellGroup(cellGroup || "");
    setTab("dashboard");
    
    // Store full user info in DataMart
    if (fullUserInfo) {
      DataMart.setCurrentUser(fullUserInfo);
    }
    
    EventPublisher.publish(EventDef.onLoginSuccess, { name, permission, title, cellGroup });
  }

  function handleLogout() {
    sessionStorage.removeItem("milal_user");
    sessionStorage.removeItem("milal_permission");
    sessionStorage.removeItem("milal_title");
    sessionStorage.removeItem("milal_cell_group");
    setUserName("");
    setUserPermission("member");
    setUserTitle("");
    setUserCellGroup("");
    DataMart.clearCurrentUser();
  }

  const [form, setForm] = useState({
    room_id: "",
    requester_name: "",
    phone: "",
    email: "",
    purpose: "",
    attendees: 1,
    notes: "",
    ...defaultTimes(),
  });

  const [multiForm, setMultiForm] = useState({
    room_ids: [],
    requester_name: "",
    phone: "",
    email: "",
    purpose: "",
    attendees: 1,
    notes: "",
    permission: "member",
    ...defaultTimes(),
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [roomData, reservationData] = await Promise.all([
        api.getRooms(),
        api.getReservations(),
      ]);
      setRooms(roomData);
      setReservations(reservationData);
      if (!form.room_id && roomData.length > 0) {
        setForm((prev) => ({ ...prev, room_id: String(roomData[0].id) }));
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!userName) {
      setCanApproveExpenses(false);
      setExpenseApprovalCount(0);
      return;
    }

    api.getExpenseApprovalSummary()
      .then((summary) => {
        setCanApproveExpenses(Boolean(summary.is_approver));
        setExpenseApprovalCount(summary.pending_count || 0);
      })
      .catch(() => {
        setCanApproveExpenses(false);
        setExpenseApprovalCount(0);
      });
  }, [userName]);

  function refreshExpenseApprovalSummary() {
    if (!userName) return;
    api.getExpenseApprovalSummary()
      .then((summary) => {
        setCanApproveExpenses(Boolean(summary.is_approver));
        setExpenseApprovalCount(summary.pending_count || 0);
      })
      .catch(() => {
        setCanApproveExpenses(false);
        setExpenseApprovalCount(0);
      });
  }

  // ── Silent background polling ──────────────────────────────────────────
  // Single source of truth for rooms/reservations: children read them via
  // props instead of running their own polls, to avoid piling up redundant
  // DB requests every few seconds (each open tab was previously running
  // 3-4 independent pollers at once).
  useEffect(() => {
    if (!userName) return;

    async function refresh() {
      try {
        const [roomData, reservationData, approvalSummary] = await Promise.all([
          api.getRooms(),
          api.getReservations(),
          api.getExpenseApprovalSummary(),
        ]);
        setRooms(roomData);
        setCanApproveExpenses(Boolean(approvalSummary.is_approver));
        setExpenseApprovalCount(approvalSummary.pending_count || 0);
        setReservations((prev) => {
          if (userPermission === "admin") {
            const prevPending = prev.filter((r) => r.status === "pending").length;
            const newPending  = reservationData.filter((r) => r.status === "pending").length;
            if (newPending > prevPending) {
              setSuccess(`🔔 새로운 예약 신청 ${newPending - prevPending}건이 접수됐습니다.`);
            }
          }
          return reservationData;
        });
      } catch {
        // silent — don't surface background errors
      }
    }

    const INTERVAL = tab === "admin" ? 5_000 : 10_000;
    const timer = setInterval(refresh, INTERVAL);

    // Refresh immediately on any create/update anywhere (including
    // self-service edits made directly from ReservedItem) instead of
    // waiting for the next poll tick.
    EventPublisher.addEventListener(EventDef.onReservationCreated, "APP_REFRESH", refresh);
    EventPublisher.addEventListener(EventDef.onReservationUpdated, "APP_REFRESH", refresh);

    return () => {
      clearInterval(timer);
      EventPublisher.removeEventListener(EventDef.onReservationCreated, "APP_REFRESH");
      EventPublisher.removeEventListener(EventDef.onReservationUpdated, "APP_REFRESH");
    };
  }, [userName, tab, userPermission]);


  async function handleCreateReservation(formData) {
    setError("");
    setSuccess("");

    try {
      const requestObj = {
        ...formData,
        room_id: Number(formData.room_id) || 0,
        attendees: Number(formData.attendees) || 1,
        repeat_count: Number(formData.repeat_count) || 1,
        start_time: localISOStringToUTCISO(formData.start_time),
        end_time: localISOStringToUTCISO(formData.end_time),
      };
      console.log("Creating reservation with data:", requestObj);
      await api.createReservation(requestObj );

      setSuccess("Reservation request created. Admin review is required.");
      setForm((prev) => ({
        ...prev,
        requester_name: "",
        phone: "",
        email: "",
        purpose: "",
        attendees: 1,
        notes: "",
        ...defaultTimes(),
      }));
      // Publish event so calendar components can refresh their data
      EventPublisher.publish(EventDef.onReservationCreated, { status: "success" });
    } catch (err) {
      setError(err.message || "Failed to create reservation");
    }
  }

  async function handleCreateMultiReservation(formData) {
    setError("");
    setSuccess("");

    const { room_ids = [], ...shared } = formData;
    try {
      const results = await Promise.allSettled(
        room_ids.map((roomId) =>
          api.createReservation({
            ...shared,
            room_id: Number(roomId) || 0,
            attendees: Number(shared.attendees) || 1,
            repeat_count: Number(shared.repeat_count) || 1,
            start_time: localISOStringToUTCISO(shared.start_time),
            end_time: localISOStringToUTCISO(shared.end_time),
          })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        setSuccess(`${succeeded}개 장소에 대한 예약 신청이 생성되었습니다. 관리자 승인이 필요합니다.`);
      } else {
        setError(`${succeeded}건 성공, ${failed}건 실패했습니다.`);
      }
      setMultiForm((prev) => ({
        ...prev,
        room_ids: [],
        requester_name: "",
        phone: "",
        email: "",
        purpose: "",
        attendees: 1,
        notes: "",
        ...defaultTimes(),
      }));
      EventPublisher.publish(EventDef.onReservationCreated, { status: "success" });
    } catch (err) {
      setError(err.message || "Failed to create reservations");
    }
  }

  async function handleAdminAction(id, action, updatedData = {}) {
    setError("");
    setSuccess("");

    try {
      const payload = {
        action,
        admin_comment: updatedData.admin_comment || "",
      };

      // Room/time edits should apply regardless of the chosen status
      // (approve/change), otherwise edits made while approving are lost.
      if (updatedData.room_id) {
        payload.room_id = Number(updatedData.room_id);
      }
      if (updatedData.start_time) {
        payload.start_time = new Date(updatedData.start_time).toISOString();
      }
      if (updatedData.end_time) {
        payload.end_time = new Date(updatedData.end_time).toISOString();
      }

      console.log("Admin action payload:", payload, id);
      await api.adminUpdateReservation(
        id,
        payload
      );

      // Display success message with action description
      const actionLabels = {
        approve: "승인",
        reject: "거절",
        change: "변경"
      };
      const actionLabel = actionLabels[action] || action;
      setSuccess(`예약 #${id} ${actionLabel}됨 - 이메일 발송됨`);
      
      // Publish update event for immediate UI refresh (before loadData completes)
      EventPublisher.publish(EventDef.onReservationUpdated, { id, action, status: "success" });
      
      // Fetch updated data in background
      await loadData();
    } catch (err) {
      console.error("Admin action error:", err);
      setError(err.message || "처리 실패");
    }
  }

  const pendingCount = reservations.filter(r => r.status === "pending").length;

  if (!userName) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#fcfdff" }}>
        <LoginModal open onLogin={handleLogin} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fcfdff" }}>
      <Sidebar
        activeTab={tab}
        onDashboard={() => {
          setTab("dashboard");
          setMobileDrawerOpen(false);
        }}
        onTabChange={(t) => {
          setTab(t);
          setMobileDrawerOpen(false);
        }}
        onRefresh={loadData}
        pendingCount={pendingCount}
        expenseApprovalCount={expenseApprovalCount}
        canApproveExpenses={canApproveExpenses}
        mobileOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />
      <TopBar
        userName={userName}
        pageTitle={TABS.find((t) => t.key === tab)?.label || ""}
        subtitle={getPageSubtitle()}
        onLogout={handleLogout}
        onMenuClick={() => setMobileDrawerOpen(true)}
        isMobile={isMobile}
      />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          pt: { xs: "60px", md: "72px" },
          pb: { xs: "72px", md: 4 },
          overflow: "auto",
          width: { xs: "100%", md: "auto" },
          minWidth: 0,
        }}
      >
        <Box sx={{ maxWidth: "1400px", mx: "auto" }}>

          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading...</Typography>
            </Box>
          )}

          <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={() => setError("")}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert onClose={() => setError("")} severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          </Snackbar>

          <Snackbar
            open={!!success}
            autoHideDuration={6000}
            onClose={() => setSuccess("")}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert onClose={() => setSuccess("")} severity="success" sx={{ width: "100%" }}>
              {success}
            </Alert>
          </Snackbar>

          {!loading && tab === "timeline" && (
            <ReservationTimeline rooms={rooms} reservations={reservations} onCreateReservation={handleCreateReservation} guideText={t("timelineGuideText")} />
          )}
          {!loading && tab === "dashboard" && (
            <Dashboard
              userName={userName}
              userPermission={userPermission}
              reservations={reservations}
              canApproveExpenses={canApproveExpenses}
              onTabChange={setTab}
            />
          )}
          {!loading && tab === "request" && (
            <ReservationRequestForm
              rooms={rooms}
              reservations={reservations}
              form={form}
              setForm={setForm}
              onSubmit={handleCreateReservation}
              guideText={t("requestGuideText")}
            />
          )}
          {!loading && tab === "multi-request" && userPermission === "admin" && (
            <MultiRoomReservationRequestForm
              rooms={rooms}
              form={multiForm}
              setForm={setMultiForm}
              onSubmit={handleCreateMultiReservation}
              guideText={t("multiRequestGuideText")}
              currentUser={DataMart.getCurrentUser()}
            />
          )}
          {!loading && tab === "admin" && (
            <AdminReservationPanel
              rooms={rooms}
              reservations={reservations}
              onAdminAction={handleAdminAction}
              guideText={t("adminGuideText")}
            />
          )}
          {!loading && tab === "member-search" && (
            <AdminSearchMembers />
          )}
          {!loading && tab === "users" && (
            <UserManagement />
          )}
          {!loading && tab === "space-settings" && (
            <RoomSettingsPanel
              onRoomsChanged={loadData}
              guideText={t("settingsGuideText")}
            />
          )}
          {tab === "cell-group" && (
            <CellGroupInfoModal />
          )}
          {tab === "cell-report" && (
            <CellReportPanel />
          )}
          {tab === "expense" && (
            <ExpensePanel initialExpenseId={linkedExpenseId} />
          )}
          {tab === "expense-approval" && (
            <ExpenseApproval initialExpenseId={linkedExpenseId} onApprovalChanged={refreshExpenseApprovalSummary} />
          )}
          {tab === "expense-account-management" && canApproveExpenses && (
            <ExpenseAccountManagement onOpenDetail={(accountId) => {
              setExpenseAccountDetailId(accountId);
              setTab("expense-account-detail");
            }} />
          )}
          {tab === "expense-account-detail" && canApproveExpenses && (
            <ExpenseAccountDetail accountId={expenseAccountDetailId} onBack={() => setTab("expense-account-management")} />
          )}
          {tab === "expense-approval-route-management" && canApproveExpenses && (
            <ExpenseApprovalRouteManagement />
          )}
        </Box>
      </Box>

      {/* Bottom Navigation – mobile only */}
      {isMobile && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            zIndex: (t) => t.zIndex.appBar,
            borderTop: "1px solid #eef2f7",
          }}
        >
          <BottomNavigation
            value={tab}
            onChange={(_, newValue) => setTab(newValue)}
            sx={{ height: "58px", bgcolor: "white" }}
          >
            <BottomNavigationAction
              label={t("navTimeline")}
              value="timeline"
              icon={NavIconTimeline}
              sx={{ minWidth: 0, fontSize: "10px", "& .MuiBottomNavigationAction-label": { fontSize: "10px" } }}
            />
            <BottomNavigationAction
              label={t("navRequest")}
              value="request"
              icon={NavIconRequest}
              sx={{ minWidth: 0, fontSize: "10px", "& .MuiBottomNavigationAction-label": { fontSize: "10px" } }}
            />
            <BottomNavigationAction
              label={t("navAdmin")}
              value="admin"
              icon={
                <Badge badgeContent={pendingCount || null} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "9px", height: 14, minWidth: 14 } }}>
                  {NavIconAdmin}
                </Badge>
              }
              sx={{ minWidth: 0, fontSize: "10px", "& .MuiBottomNavigationAction-label": { fontSize: "10px" } }}
            />
            <BottomNavigationAction
              label={t("navSettings")}
              value="space-settings"
              icon={NavIconSettings}
              sx={{ minWidth: 0, fontSize: "10px", "& .MuiBottomNavigationAction-label": { fontSize: "10px" } }}
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* AI Chat Widget - always visible when logged in */}
      {userName && (
        <ChatWidget
          userName={userName}
          userPhone={DataMart.getCurrentUser()?.phone || ""}
          userEmail={DataMart.getCurrentUser()?.email || ""}
          userTitle={userTitle}
          userCellGroup={userCellGroup}
        />
      )}
    </Box>
  );
}
