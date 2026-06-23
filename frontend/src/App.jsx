import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { api } from "./api";
import AdminReservationPanel from "./components/AdminReservationPanel";
import LoginModal from "./components/LoginModal";
import ReservationRequestForm from "./components/ReservationRequestForm";
import ReservationTimeline from "./components/ReservationTimeline";
import RoomSettingsPanel from "./components/RoomSettingsPanel";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

const TABS = [
  { key: "timeline", label: "Reservation Status" },
  { key: "request", label: "New Request" },
  { key: "admin", label: "Admin Review" },
  { key: "space-settings", label: "Room Settings" },
];

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
  const [tab, setTab] = useState("timeline");
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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fcfdff" }}>
      <LoginModal open={!userName} onLogin={handleLogin} />
      <Sidebar 
        activeTab={tab} 
        onTabChange={setTab} 
        onRefresh={loadData}
        pendingCount={reservations.filter(r => r.status === "pending").length}
      />
      <TopBar
        userName={userName}
        pageTitle={TABS.find((t) => t.key === tab)?.label || ""}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, p: 4, pt: "72px", overflow: "auto" }}>
        <Box sx={{ maxWidth: "1400px", mx: "auto" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Users do not need account login. Phone and email are required for every request.
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
    </Box>
  );
}
