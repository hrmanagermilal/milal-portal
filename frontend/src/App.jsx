import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { api } from "./api";
import DataMart from "./common/DataMart";
import AdminReservationPanel from "./components/room-reservation/AdminReservationPanel";
import LoginModal from "./components/LoginModal";
import ReservationRequestForm from "./components/room-reservation/ReservationRequestForm";
import ReservationTimeline from "./components/room-reservation/ReservationTimeline";
import RoomSettingsPanel from "./components/room-reservation/RoomSettingsPanel";
import CellGroupInfoModal from "./components/cell_group/CellGroupInfoModal";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { useLanguage } from "./i18n/LanguageContext";
import EventPublisher from "./event/EventPublisher";
import {EventDef} from "./event/EventDef";
import { localISOStringToUTCISO } from "./utils/datetime";

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
  const start = now.toISOString().slice(0, 16);
  const end = new Date(now.getTime() + 3600000).toISOString().slice(0, 16);
  return { start_time: start, end_time: end };
}

export default function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useLanguage();

  const getPageSubtitle = () => {
    switch (tab) {
      case "cell-group":
        return t("cellGroupGuideText");
      default:
        return t("appSubtitle");
    }
  };

  const TABS = [
    { key: "timeline", label: t("navTimeline") },
    { key: "request",  label: t("navRequest") },
    { key: "admin",    label: t("navAdmin") },
    { key: "space-settings", label: t("navSettings") },
    { key: "cell-group", label: t("navCellGroupInfo") },
  ];

  const [tab, setTab] = useState("timeline");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userName, setUserName] = useState(() => localStorage.getItem("milal_user") || "");
  const [userPermission, setUserPermission] = useState(() => localStorage.getItem("milal_permission") || "member");
  const [userTitle, setUserTitle] = useState(() => localStorage.getItem("milal_title") || "");
  const [userCellGroup, setUserCellGroup] = useState(() => localStorage.getItem("milal_cell_group") || "");

  function handleLogin(name, permission, title, cellGroup, fullUserInfo) {
    localStorage.setItem("milal_user", name);
    localStorage.setItem("milal_permission", permission);
    localStorage.setItem("milal_title", title || "");
    localStorage.setItem("milal_cell_group", cellGroup || "");
    setUserName(name);
    setUserPermission(permission);
    setUserTitle(title || "");
    setUserCellGroup(cellGroup || "");
    
    // Store full user info in DataMart
    if (fullUserInfo) {
      DataMart.setCurrentUser(fullUserInfo);
    }
    
    EventPublisher.publish(EventDef.onLoginSuccess, { name, permission, title, cellGroup });
  }

  function handleLogout() {
    localStorage.removeItem("milal_user");
    localStorage.removeItem("milal_title");
    localStorage.removeItem("milal_cell_group");
    setUserName("");
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

  async function handleCreateReservation(formData) {
    setError("");
    setSuccess("");

    try {
      await api.createReservation({
        ...formData,
        room_id: Number(formData.room_id),
        attendees: Number(formData.attendees),
        start_time: localISOStringToUTCISO(formData.start_time),
        end_time: localISOStringToUTCISO(formData.end_time),
      });

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

  async function handleAdminAction(id, action, updatedData = {}) {
    setError("");
    setSuccess("");

    try {
      const payload = {
        action,
        admin_comment: updatedData.admin_comment || "",
      };

      if (action === "change") {
        if (updatedData.room_id) {
          payload.room_id = Number(updatedData.room_id);
        }
        if (updatedData.start_time) {
          payload.start_time = new Date(updatedData.start_time).toISOString();
        }
        if (updatedData.end_time) {
          payload.end_time = new Date(updatedData.end_time).toISOString();
        }
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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fcfdff" }}>
      <LoginModal open={!userName} onLogin={handleLogin} />
      <Sidebar
        activeTab={tab}
        onTabChange={(t) => {
          setTab(t);
          setMobileDrawerOpen(false);
        }}
        onRefresh={loadData}
        pendingCount={pendingCount}
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
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

          {!loading && tab === "timeline" && (
            <ReservationTimeline rooms={rooms} reservations={reservations} onCreateReservation={handleCreateReservation} guideText={t("timelineGuideText")} />
          )}
          {!loading && tab === "request" && (
            <ReservationRequestForm
              rooms={rooms}
              form={form}
              setForm={setForm}
              onSubmit={handleCreateReservation}
              guideText={t("requestGuideText")}
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
          {!loading && tab === "space-settings" && (
            <RoomSettingsPanel
              onRoomsChanged={loadData}
              guideText={t("settingsGuideText")}
            />
          )}
          {tab === "cell-group" && (
            <CellGroupInfoModal />
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
    </Box>
  );
}
