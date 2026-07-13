import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { api } from "../../api";

/**
 * Default floor plan layout structure
 * Room data is loaded dynamically from the database
 */
const DEFAULT_FLOOR_PLANS = {
  1: {
    viewBox: "0 0 640 420",
    building: { x: 16, y: 16, width: 608, height: 388 },
    rooms: [],
    corridors: [
      { x: 36, y: 200, width: 568, height: 12 },
    ],
  },
  2: {
    viewBox: "0 0 640 420",
    building: { x: 16, y: 16, width: 608, height: 388 },
    rooms: [],
    corridors: [
      { x: 36, y: 228, width: 568, height: 12 },
    ],
  },
};

const FLOOR_PLANS = DEFAULT_FLOOR_PLANS;

/** Map room ID → floor number (built from database) */
const ROOM_FLOOR = {};

function FloorPlanSVG({ floorData, floorNum, activeRoomId, onSelectRoom, isSelectable, roomLocations = {}, visibleRoomIds, zoom = 1, panX = 0, panY = 0 }) {
  const { viewBox, building, rooms: defaultRooms, corridors } = floorData;
  const labelLineHeight = isSelectable ? 18 : 14;
  const labelOffset = isSelectable ? 9 : 7;
  const labelFontSize = isSelectable ? 13.5 : 8.5;
  const activeLabelFontSize = isSelectable ? 15 : 9.5;
  
  // Merge custom room locations with default rooms
  const displayRooms = defaultRooms.map(room => {
    const customLocation = roomLocations[room.id];
    if (customLocation) {
      return {
        ...room,
        x: customLocation.x1,
        y: customLocation.y1,
        width: customLocation.x2 - customLocation.x1,
        height: customLocation.y2 - customLocation.y1,
      };
    }
    return room;
  }).filter((room) => !visibleRoomIds || visibleRoomIds.has(room.id));

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformOrigin: "center",
      }}
    >
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          width: "100%", 
          height: "100%",
          display: "block",
          touchAction: "none",
          transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
          transformOrigin: "center",
          transition: zoom === 1 && panX === 0 && panY === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        {/* Floor plan background image */}
        <image
          x={building.x}
          y={building.y}
          width={building.width}
          height={building.height}
          href={`/image/floor-${floorNum || 1}.png`}
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Building outline */}
        <rect
          x={building.x} y={building.y}
          width={building.width} height={building.height}
          rx={4} ry={4}
          fill="none"
          stroke="#90a4c0"
          strokeWidth={1.5}
        />

        {/* Corridors */}
        {corridors.map((c, i) => (
          <rect
            key={i}
            x={c.x} y={c.y}
            width={c.width} height={c.height}
            fill="#dce5f0"
          />
        ))}

        {/* Rooms */}
        {displayRooms.map((room) => {
          const isActive = room.id === activeRoomId;
          const isCustomLocation = roomLocations[room.id];
          return (
            <g 
              key={room.id}
              onClick={() => isSelectable && onSelectRoom && onSelectRoom(room.id)}
              style={{ cursor: isSelectable ? "pointer" : "default" }}
            >
              <rect
                x={room.x} y={room.y}
                width={room.width} height={room.height}
                rx={3} ry={3}
                fill={isActive ? "rgba(25,118,210,0.22)" : "#e8edf5"}
                stroke={isActive ? "#1976d2" : isCustomLocation ? "#ff9800" : "#a8b8cc"}
                strokeWidth={isActive ? 2 : isCustomLocation ? 2 : 1}
                strokeDasharray={isCustomLocation ? "4,2" : "none"}
                style={{ transition: "all 0.2s", pointerEvents: "auto" }}
                onMouseEnter={(e) => {
                  if (isSelectable) {
                    e.currentTarget.style.fill = "rgba(25,118,210,0.35)";
                    e.currentTarget.style.stroke = "#1565c0";
                    e.currentTarget.style.strokeWidth = "2";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.fill = isActive ? "rgba(25,118,210,0.22)" : "#e8edf5";
                  e.currentTarget.style.stroke = isActive ? "#1976d2" : isCustomLocation ? "#ff9800" : "#a8b8cc";
                  e.currentTarget.style.strokeWidth = isActive ? "2" : isCustomLocation ? "2" : "1";
                }}
              />
              {/* Room label – split on \n */}
              {room.label.split("\n").map((line, i, arr) => (
                <text
                  key={i}
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 - ((arr.length - 1) * labelOffset) + i * labelLineHeight}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isActive ? activeLabelFontSize : labelFontSize}
                  fontWeight={isSelectable ? "700" : isActive ? "700" : "500"}
                  fill={isActive ? "#0f4aa1" : isSelectable ? "#31445a" : "#5d7186"}
                  fontFamily="inherit"
                  style={{
                    pointerEvents: "none",
                    paintOrder: "stroke",
                    stroke: "rgba(255,255,255,0.95)",
                    strokeWidth: isSelectable ? 2.5 : 1.5,
                    strokeLinejoin: "round",
                  }}
                >
                  {line}
                </text>
              ))}
              {/* Active marker dot */}
              {isActive && (
                <circle
                  cx={room.x + room.width - 8}
                  cy={room.y + 8}
                  r={4}
                  fill="#1976d2"
                />
              )}
              {/* Custom location indicator */}
              {isCustomLocation && !isActive && (
                <circle
                  cx={room.x + room.width - 8}
                  cy={room.y + 8}
                  r={3.5}
                  fill="none"
                  stroke="#ff9800"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}

        {/* Entrance arrow at bottom */}
        <text
          x={building.x + building.width / 2}
          y={building.y + building.height + 10}
          textAnchor="middle"
          fontSize={8}
          fill="#8fa3b8"
          fontFamily="inherit"
        >
          ▼ Entrance
        </text>
      </svg>
    </Box>
  );
}

export default function FloorPlanTooltip({ roomId, roomName, children, mode = "hover", onSelectRoom, floor, visibleRoomIds }) {
  const boxRef = useRef(null);
  const svgContainerRef = useRef(null);
  const [show, setShow] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartDistance, setTouchStartDistance] = useState(0);
  const [roomLocations, setRoomLocations] = useState({});
  const [dynamicRoomFloor, setDynamicRoomFloor] = useState(ROOM_FLOOR);
  const [dynamicFloorPlans, setDynamicFloorPlans] = useState(FLOOR_PLANS);

  // Reset zoom/pan when modal opens/closes
  useEffect(() => {
    if (!show) {
      setZoom(1);
      setPanX(0);
      setPanY(0);
    }
  }, [show]);

  // Handle mouse wheel zoom
  useEffect(() => {
    if (!show) return;

    const handleWheel = (e) => {
      if (!svgContainerRef.current?.contains(e.target)) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(1, Math.min(5, zoom * delta));
      setZoom(newZoom);
    };

    const container = svgContainerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [show, zoom]);

  // Mouse drag handler (PC)
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers (모바일)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchStartDistance(distance);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (touchStartDistance > 0) {
        const ratio = currentDistance / touchStartDistance;
        const newZoom = Math.max(1, Math.min(5, zoom * ratio));
        setZoom(newZoom);
        setTouchStartDistance(currentDistance);
      }
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(5, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(1, prev - 0.2));
  };

  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Load rooms from database and build dynamic mappings
  useEffect(() => {
    async function loadRoomsData() {
      try {
        const rooms = await api.getRooms();
        
        // Build ROOM_FLOOR mapping from database
        const roomFloorMap = {};
        rooms.forEach(room => {
          roomFloorMap[room.id] = room.floor;
        });
        setDynamicRoomFloor(roomFloorMap);

        // Build FLOOR_PLANS from database - group rooms by floor
        const updatedFloorPlans = {};
        [1, 2].forEach(floorNum => {
          updatedFloorPlans[floorNum] = {
            viewBox: "0 0 640 420",
            building: { x: 16, y: 16, width: 608, height: 388 },
            rooms: [],
            corridors: DEFAULT_FLOOR_PLANS[floorNum]?.corridors || [],
          };
        });

        // Add rooms from database to their respective floors
        rooms.forEach(room => {
          const floorNum = room.floor || 1;
          if (!updatedFloorPlans[floorNum]) {
            updatedFloorPlans[floorNum] = {
              viewBox: "0 0 640 420",
              building: { x: 16, y: 16, width: 608, height: 388 },
              rooms: [],
              corridors: [],
            };
          }

          // Generate auto-positioned layout for all rooms from database
          const roomIndex = updatedFloorPlans[floorNum].rooms.length;
          const roomObj = {
            id: room.id,
            label: room.name,
            x: 36 + ((roomIndex % 3) * 200),
            y: 40 + ((Math.floor(roomIndex / 3)) * 180),
            width: 180,
            height: 160,
          };

          updatedFloorPlans[floorNum].rooms.push(roomObj);
        });

        setDynamicFloorPlans(updatedFloorPlans);
      } catch (err) {
        console.error("Failed to load rooms from database:", err);
        // If API fails, keep using initial empty state - no hardcoded fallback
      }
    }
    loadRoomsData();
  }, []);

  // Convert roomId to number if string
  const id = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
  
  // In select mode, use provided floor prop; in hover mode, look up from dynamic ROOM_FLOOR
  const floorNum = mode === "select" ? floor : dynamicRoomFloor[id];
  const floorData = floorNum ? dynamicFloorPlans[floorNum] : null;

  const isSelectMode = mode === "select";
  const selectableRoomIds = visibleRoomIds ? new Set(visibleRoomIds) : null;

  // Load room locations from API
  useEffect(() => {
    async function loadLocations() {
      try {
        const locations = await api.adminGetAllRoomLocations();
        if (locations && Array.isArray(locations)) {
          const locationMap = {};
          locations.forEach(loc => {
            locationMap[loc.room_id] = loc;
          });
          setRoomLocations(locationMap);
        }
      } catch (err) {
        // Silently fail - will show default room layout
        console.error("Failed to load room locations:", err);
      }
    }
    loadLocations();
  }, []);

  useEffect(() => {
    if (!show) {
      return;
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!floorData) {
    return children;
  }

  const handleSelectRoom = (roomId) => {
    if (onSelectRoom) {
      onSelectRoom(roomId);
    }
  };

  return (
    <>
      {isSelectMode ? (
        <div
          ref={boxRef}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #d8dfe7",
            backgroundColor: "#f8f9fa",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontWeight: 700,
              color: "#5d7186",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "10px",
              mb: 1,
            }}
          >
            Floor {floorNum} · Select Room
          </Typography>
          <FloorPlanSVG 
            floorData={floorData}
            floorNum={floorNum}
            activeRoomId={id} 
            onSelectRoom={handleSelectRoom}
            isSelectable={true}
            roomLocations={roomLocations}
            visibleRoomIds={selectableRoomIds}
          />
        </div>
      ) : (
        <span
          style={{
            display: "inline-block",
            cursor: "pointer",
            borderBottom: "1px dotted #1976d2",
            position: "relative",
            minWidth: "auto",
            padding: "2px 4px",
          }}
          onClick={() => setShow(true)}
        >
          {children}
        </span>
      )}

      {show && !isSelectMode && ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          <Box
            onClick={() => setShow(false)}
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 99998,
            }}
          />
          
          {/* Modal */}
          <Paper
            elevation={16}
            sx={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(90vw, 900px)",
              height: "min(90vh, 700px)",
              display: "flex",
              flexDirection: "column",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              zIndex: 99999,
              pointerEvents: "auto",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 2,
                borderBottom: "1px solid #e0e0e0",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: "#2c3e50",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Floor {floorNum} · {roomName}
              </Typography>
              <IconButton
                onClick={() => setShow(false)}
                size="small"
                sx={{
                  color: "#666",
                  "&:hover": { color: "#000", backgroundColor: "#f0f0f0" },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Zoom Controls (PC only) */}
            <Box
              sx={{
                display: "flex",
                gap: 1,
                p: 1.5,
                borderBottom: "1px solid #e0e0e0",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <IconButton
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                size="small"
                title="줄이기"
              >
                <RemoveIcon />
              </IconButton>
              
              <Typography
                sx={{
                  fontWeight: 600,
                  color: "#666",
                  minWidth: "60px",
                  textAlign: "center",
                  fontSize: "14px",
                }}
              >
                {(zoom * 100).toFixed(0)}%
              </Typography>
              
              <IconButton
                onClick={handleZoomIn}
                disabled={zoom >= 5}
                size="small"
                title="확대"
              >
                <AddIcon />
              </IconButton>
              
              <Box sx={{ flex: 1 }} />
              
              <Typography
                variant="caption"
                sx={{
                  color: "#999",
                  fontSize: "12px",
                }}
              >
                {zoom > 1 ? "드래그로 이동" : "모바일: 핀치 / PC: ±버튼"}
              </Typography>
            </Box>

            {/* Floor Plan SVG Container */}
            <Box
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => setTouchStartDistance(0)}
              sx={{
                flex: 1,
                overflow: "hidden",
                backgroundColor: "#fafafa",
                cursor: zoom > 1 && isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
                userSelect: "none",
                touchAction: "none",
              }}
            >
              <FloorPlanSVG 
                floorData={floorData}
                floorNum={floorNum}
                activeRoomId={id}
                isSelectable={false}
                roomLocations={roomLocations}
                zoom={zoom}
                panX={panX}
                panY={panY}
              />
            </Box>
          </Paper>
        </>,
        document.body
      )}
    </>
  );
}
