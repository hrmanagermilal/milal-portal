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
import AdminReservationPanel from "./components/AdminReservationPanel";
import LoginModal from "./components/LoginModal";
import ReservationRequestForm from "./components/ReservationRequestForm";
import ReservationTimeline from "./components/ReservationTimeline";
import RoomSettingsPanel from "./components/RoomSettingsPanel";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { useLanguage } from "./i18n/LanguageContext";

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

  const TABS = [
    { key: "timeline", label: t("navTimeline") },
    { key: "request",  label: t("navRequest") },
    { key: "admin",    label: t("navAdmin") },
    { key: "space-settings", label: t("navSettings") },
  ];

  const [tab, setTab] = useState("timeline");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userName, setUserName] = useState(() => localStorage.getItem("milal_user") || "");

  function handleLogin(name) {
    localStorage.setItem("milal_user", name);
    setUserName(name);
  }

  function handleLogout() {
    localStorage.removeItem("milal_user");
    setUserName("");
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

  const [adminKey, setAdminKey] = useState("");
  const [adminComment, setAdminComment] = useState({});
  const [adminRoomId, setAdminRoomId] = useState({});
  const [adminStartTime, setAdminStartTime] = useState({});
  const [adminEndTime, setAdminEndTime] = useState({});

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

  async function handleCreateReservation(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await api.createReservation({
        ...form,
        room_id: Number(form.room_id),
        attendees: Number(form.attendees),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
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
      await loadData();
      setTab("timeline");
    } catch (err) {
      setError(err.message || "Failed to create reservation");
    }
  }

  async function handleAdminAction(id, action) {
    setError("");
    setSuccess("");

    try {
      const payload = {
        action,
        admin_comment: adminComment[id] || "",
      };

      if (action === "change") {
        if (adminRoomId[id]) {
          payload.room_id = Number(adminRoomId[id]);
        }
        if (adminStartTime[id]) {
          payload.start_time = new Date(adminStartTime[id]).toISOString();
        }
        if (adminEndTime[id]) {
          payload.end_time = new Date(adminEndTime[id]).toISOString();
        }
      }

      console.log("Admin action payload:", payload, id, adminKey);
      await api.adminUpdateReservation(
        id,
        payload,
        adminKey
      );

      setSuccess(`Reservation #${id} updated: ${action}`);
      await loadData();
    } catch (err) {
      console.error("Admin action error:", err);
      setError(err.message || "Admin action failed");
    }
  }

  const pendingCount = reservations.filter(r => r.status === "pending").length;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fcfdff" }}>
      <LoginModal open={!userName} onLogin={handleLogin} />
      <Sidebar
        activeTab={tab}
        onTabChange={(t) => { setTab(t); setMobileDrawerOpen(false); }}
        onRefresh={loadData}
        pendingCount={pendingCount}
        mobileOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />
      <TopBar
        userName={userName}
        pageTitle={TABS.find((t) => t.key === tab)?.label || ""}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: "12px", md: "14px" } }}>
            {t("appSubtitle")}
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading...</Typography>
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

          {!loading && tab === "timeline" && (
            <ReservationTimeline rooms={rooms} reservations={reservations} onCreateReservation={handleCreateReservation} />
          )}
          {!loading && tab === "request" && (
            <ReservationRequestForm
              rooms={rooms}
              form={form}
              setForm={setForm}
              onSubmit={handleCreateReservation}
            />
          )}
          {!loading && tab === "admin" && (
            <AdminReservationPanel
              rooms={rooms}
              reservations={reservations}
              adminKey={adminKey}
              setAdminKey={setAdminKey}
              adminComment={adminComment}
              setAdminComment={setAdminComment}
              adminRoomId={adminRoomId}
              setAdminRoomId={setAdminRoomId}
              adminStartTime={adminStartTime}
              setAdminStartTime={setAdminStartTime}
              adminEndTime={adminEndTime}
              setAdminEndTime={setAdminEndTime}
              onAdminAction={handleAdminAction}
            />
          )}
          {!loading && tab === "space-settings" && (
            <RoomSettingsPanel
              adminKey={adminKey}
              setAdminKey={setAdminKey}
              onRoomsChanged={loadData}
            />
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
