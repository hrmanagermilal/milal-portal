import { useState, useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

/**
 * Floor plan layout by floor number
 * Maps floor number → floor plan dimensions and room rectangles
 */
const FLOOR_PLANS = {
  1: {
    viewBox: "0 0 640 420",
    building: { x: 16, y: 16, width: 608, height: 388 },
  },
  2: {
    viewBox: "0 0 640 420",
    building: { x: 16, y: 16, width: 608, height: 388 },
  },
};

export default function RoomMapEditor({ open, room, onClose, onSave }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [endX, setEndX] = useState(0);
  const [endY, setEndY] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingLocation, setExistingLocation] = useState(null);

  const floorPlan = FLOOR_PLANS[room?.floor || 1];
  const building = floorPlan.building;
  const svgWidth = 640;
  const svgHeight = 420;

  // Load existing location when modal opens
  useEffect(() => {
    if (open && room?.id) {
      loadExistingLocation();
    }
  }, [open, room?.id]);

  async function loadExistingLocation() {
    try {
      const location = await api.adminGetRoomLocation(room.id);
      if (location) {
        setExistingLocation(location);
        setStartX(location.x1);
        setStartY(location.y1);
        setEndX(location.x2);
        setEndY(location.y2);
      }
    } catch (err) {
      // No existing location is OK
      setExistingLocation(null);
    }
  }

  function getCoordinatesFromMouseEvent(event) {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert pixel coordinates to SVG viewBox coordinates
    const svgX = (x / rect.width) * 640;
    const svgY = (y / rect.height) * 420;

    return { x: Math.max(0, Math.min(640, svgX)), y: Math.max(0, Math.min(420, svgY)) };
  }

  function handleMouseDown(event) {
    const coords = getCoordinatesFromMouseEvent(event);
    setStartX(coords.x);
    setStartY(coords.y);
    setEndX(coords.x);
    setEndY(coords.y);
    setIsDrawing(true);
    setError("");
  }

  function handleMouseMove(event) {
    if (!isDrawing) return;

    const coords = getCoordinatesFromMouseEvent(event);
    setEndX(coords.x);
    setEndY(coords.y);
  }

  function handleMouseUp() {
    setIsDrawing(false);
  }

  function validateCoordinates() {
    const x1 = Math.min(startX, endX);
    const y1 = Math.min(startY, endY);
    const x2 = Math.max(startX, endX);
    const y2 = Math.max(startY, endY);

    const width = x2 - x1;
    const height = y2 - y1;

    if (width < 10 || height < 10) {
      setError(t("mapEditorMinSizeError") || "Rectangle must be at least 10x10 units");
      return false;
    }

    return true;
  }

  async function handleSave() {
    if (!validateCoordinates()) return;

    setLoading(true);
    setError("");
    try {
      const x1 = Math.min(startX, endX);
      const y1 = Math.min(startY, endY);
      const x2 = Math.max(startX, endX);
      const y2 = Math.max(startY, endY);

      await api.adminSaveRoomLocation(room.id, { x1, y1, x2, y2 });
      onSave?.();
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to save room location");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose?.();
    setIsDrawing(false);
    setStartX(0);
    setStartY(0);
    setEndX(0);
    setEndY(0);
    setError("");
  }

  function handleClear() {
    setStartX(0);
    setStartY(0);
    setEndX(0);
    setEndY(0);
    setError("");
  }

  // Calculate normalized rectangle for display
  const rectX1 = Math.min(startX, endX);
  const rectY1 = Math.min(startY, endY);
  const rectX2 = Math.max(startX, endX);
  const rectY2 = Math.max(startY, endY);
  const rectWidth = rectX2 - rectX1;
  const rectHeight = rectY2 - rectY1;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t("mapEditorTitle") || "Edit Room Location"}: {room?.name}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ mb: 2, color: "#5d7186" }}>
          {t("mapEditorInstructions") || "Click and drag on the floor plan to mark the room's location"}
        </Typography>

        {/* Floor Plan SVG */}
        <Box
          ref={svgRef}
          sx={{
            border: "2px solid #1976d2",
            borderRadius: "4px",
            mb: 2,
            cursor: isDrawing ? "crosshair" : "pointer",
            aspectRatio: "640 / 420",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            viewBox={floorPlan.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            {/* Floor plan background image */}
            <image
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              href={`/image/floor${room?.floor || 1}.png`}
              preserveAspectRatio="xMidYMid slice"
            />

            {/* Building outline */}
            <rect
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              rx={4}
              ry={4}
              fill="none"
              stroke="#90a4c0"
              strokeWidth={1.5}
            />

            {/* Grid background */}
            <defs>
              <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e0e5f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            {/* Grid overlay - removed since we have floor plan image background */}

            {/* Preview rectangle when drawing */}
            {(rectWidth > 0 || rectHeight > 0) && (
              <>
                {/* Semi-transparent fill */}
                <rect
                  x={rectX1}
                  y={rectY1}
                  width={rectWidth}
                  height={rectHeight}
                  fill="#1976d2"
                  fillOpacity="0.2"
                  stroke="#1976d2"
                  strokeWidth="2"
                />
                {/* Corner indicators */}
                <circle cx={rectX1} cy={rectY1} r="3" fill="#1976d2" />
                <circle cx={rectX2} cy={rectY1} r="3" fill="#1976d2" />
                <circle cx={rectX1} cy={rectY2} r="3" fill="#1976d2" />
                <circle cx={rectX2} cy={rectY2} r="3" fill="#1976d2" />
              </>
            )}

            {/* Dimension labels */}
            {(rectWidth > 0 || rectHeight > 0) && (
              <>
                <text
                  x={(rectX1 + rectX2) / 2}
                  y={rectY1 - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#1976d2"
                  fontWeight="bold"
                >
                  {rectWidth.toFixed(1)}
                </text>
                <text
                  x={rectX2 + 5}
                  y={(rectY1 + rectY2) / 2}
                  fontSize="10"
                  fill="#1976d2"
                  fontWeight="bold"
                >
                  {rectHeight.toFixed(1)}
                </text>
              </>
            )}
          </svg>
        </Box>

        {/* Coordinates display */}
        {(rectWidth > 0 || rectHeight > 0) && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "#f5f5f5", borderRadius: "4px" }}>
            <Typography variant="caption" display="block" sx={{ color: "#5d7186" }}>
              X: {rectX1.toFixed(1)} - {rectX2.toFixed(1)} | Y: {rectY1.toFixed(1)} - {rectY2.toFixed(1)}
            </Typography>
          </Box>
        )}

        {existingLocation && (
          <Typography variant="caption" sx={{ display: "block", color: "#4caf50", mb: 1 }}>
            ✓ {t("mapEditorHasLocation") || "Room already has location data"}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={handleClear}>
          {t("clear") || "Clear"}
        </Button>
        <Button variant="outlined" onClick={handleClose}>
          {t("cancel") || "Cancel"}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || rectWidth < 10 || rectHeight < 10}
          sx={{ bgcolor: "#2f68f9" }}
        >
          {loading ? (t("saving") || "Saving...") : (t("save") || "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
