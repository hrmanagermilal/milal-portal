import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MapIcon from "@mui/icons-material/Map";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";
import RoomMapEditor from "./RoomMapEditor";

function buildEditMap(rooms) {
  const map = {};
  rooms.forEach((room) => {
    map[room.id] = {
      name: room.name,
      capacity: room.capacity,
      description: room.description,
      floor: room.floor ?? 1,
      is_active: room.is_active,
    };
  });
  return map;
}

export default function RoomSettingsPanel({ onRoomsChanged, guideText }) {
  const { t } = useLanguage();
  const displayGuideText = guideText || t("settingsGuideText");
  const [rooms, setRooms] = useState([]);
  const [editMap, setEditMap] = useState({});
  const [originalMap, setOriginalMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mapEditorOpen, setMapEditorOpen] = useState(false);
  const [selectedRoomForMap, setSelectedRoomForMap] = useState(null);

  const [newRoom, setNewRoom] = useState({
    name: "",
    capacity: 1,
    description: "",
    floor: 1,
    is_active: true,
  });

  async function loadRooms() {
    setLoading(true);
    setError("");
    try {
      // Use admin API with JWT token
      const data = await api.adminGetRooms();
      setRooms(data);
      setEditMap(buildEditMap(data));
      setOriginalMap(buildEditMap(data));
    } catch (err) {
      setError(err.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  const activeCount = useMemo(
    () => rooms.filter((room) => room.is_active).length,
    [rooms]
  );

  async function handleCreateRoom() {
    setError("");
    setSuccess("");
    try {
      await api.adminCreateRoom({
        name: newRoom.name,
        capacity: Number(newRoom.capacity),
        description: newRoom.description,
        floor: Number(newRoom.floor),
        is_active: newRoom.is_active,
      });
      setSuccess("Room created successfully");
      setNewRoom({ name: "", capacity: 1, description: "", floor: 1, is_active: true });
      await loadRooms();
      await onRoomsChanged();
    } catch (err) {
      setError(err.message || "Failed to create room");
    }
  }

  async function handleUpdateRoom(roomId) {
    setError("");
    setSuccess("");
    try {
      const payload = editMap[roomId];
      await api.adminUpdateRoom(roomId, {
        name: payload.name,
        capacity: Number(payload.capacity),
        description: payload.description,
        floor: Number(payload.floor),
        is_active: payload.is_active,
      });
      setSuccess(`Room #${roomId} updated`);
      await loadRooms();
      await onRoomsChanged();
    } catch (err) {
      setError(err.message || "Failed to update room");
    }
  }

  async function handleDeactivateRoom(roomId) {
    setError("");
    setSuccess("");
    try {
      await api.adminDeleteRoom(roomId);
      setSuccess(`Room #${roomId} deactivated`);
      await loadRooms();
      await onRoomsChanged();
    } catch (err) {
      setError(err.message || "Failed to deactivate room");
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ color: "#5d7186" }}>
              {displayGuideText}
            </Typography>
          </Box>
          <Chip label={`총 ${activeCount} 개`} color="primary" />
        </Stack>

        {/* New Room Form */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end" sx={{ mb: 3 }}>
          <TextField
            label="장소명"
            size="small"
            value={newRoom.name}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, name: e.target.value }))}
            sx={{ width: 160 }}
          />
          <TextField
            select
            label="층"
            size="small"
            value={newRoom.floor}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, floor: e.target.value }))}
            sx={{ width: 100 }}
          >
            <MenuItem value={1}>1층</MenuItem>
            <MenuItem value={2}>2층</MenuItem>
          </TextField>
          <TextField
            label="정원"
            type="number"
            size="small"
            inputProps={{ min: 1 }}
            value={newRoom.capacity}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, capacity: e.target.value }))}
            sx={{ width: 100 }}
          />
          <TextField
            label="장소 정보"
            size="small"
            value={newRoom.description}
            onChange={(e) => setNewRoom((prev) => ({ ...prev, description: e.target.value }))}
            sx={{ width: 220 }}
          />
          <Button variant="contained" onClick={handleCreateRoom} sx={{ whiteSpace: "nowrap",  bgcolor: "#2f68f9" }}>
            장소 등록
          </Button>
        </Stack>

        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading rooms...</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: "#eef2f7" }}>
              <TableRow>
                {["No", "장소명", "층", "정원", "장소 정보", "지도", "상태", "동작"].map((h) => (
                  <TableCell key={h} sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room, idx) => {
                const edit = editMap[room.id] || {
                  name: room.name,
                  capacity: room.capacity,
                  description: room.description,
                  floor: room.floor ?? 1,
                  is_active: room.is_active,
                };
                const orig = originalMap[room.id];
                const isDirty = orig && (
                  edit.name !== orig.name ||
                  Number(edit.capacity) !== Number(orig.capacity) ||
                  edit.description !== orig.description ||
                  Number(edit.floor) !== Number(orig.floor) ||
                  Boolean(edit.is_active) !== Boolean(orig.is_active)
                );

                return (
                  <TableRow key={room.id} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={edit.name}
                        onChange={(e) =>
                          setEditMap((prev) => ({ ...prev, [room.id]: { ...edit, name: e.target.value } }))
                        }
                        sx={{ width: 180 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={edit.floor ?? 1}
                        onChange={(e) => {
                          const floor = Number(e.target.value);
                          setEditMap((prev) => ({ ...prev, [room.id]: { ...(prev[room.id] || edit), floor } }));
                        }}
                        sx={{ width: 80 }}
                      >
                        <MenuItem value={1}>1층</MenuItem>
                        <MenuItem value={2}>2층</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 1 }}
                        value={edit.capacity}
                        onChange={(e) =>
                          setEditMap((prev) => ({ ...prev, [room.id]: { ...edit, capacity: e.target.value } }))
                        }
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={edit.description}
                        onChange={(e) =>
                          setEditMap((prev) => ({ ...prev, [room.id]: { ...edit, description: e.target.value } }))
                        }
                        sx={{ width: 220 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<MapIcon />}
                        onClick={() => {
                          setSelectedRoomForMap(room);
                          setMapEditorOpen(true);
                        }}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {t("map") || "Map"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Switch
                          checked={Boolean(edit.is_active)}
                          size="small"
                          color="success"
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditMap((prev) => ({ ...prev, [room.id]: { ...(prev[room.id] || edit), is_active: checked } }));
                          }}
                        />
                        <Chip
                          label={edit.is_active ? "사용중" : "비활성"}
                          color={edit.is_active ? "success" : "default"}
                          size="small"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={!isDirty}
                          onClick={() => handleUpdateRoom(room.id)}
                          sx={{
                            ...(isDirty ? {
                              borderColor: "#1976d2",
                              color: "#1976d2",
                              fontWeight: 700,
                              "&:hover": { bgcolor: "rgba(25,118,210,0.08)" },
                            } : {}),
                          }}
                        >
                          저장
                        </Button>
                        <Button variant="outlined" color="error" size="small" onClick={() => handleDeactivateRoom(room.id)}>
                          삭제
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Room Map Editor Modal */}
        <RoomMapEditor
          open={mapEditorOpen}
          room={selectedRoomForMap}
          onClose={() => setMapEditorOpen(false)}
          onSave={() => {
            setMapEditorOpen(false);
            setSuccess("Room location saved successfully");
            loadRooms();
          }}
        />
      </CardContent>
    </Card>
  );
}
