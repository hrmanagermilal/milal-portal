import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
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

function FloorPlanSVG({ floorData, floorNum, activeRoomId, onSelectRoom, isSelectable, roomLocations = {}, rooms = [] }) {
  const { viewBox, building, rooms: defaultRooms, corridors } = floorData;
  
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
  });

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Floor plan background image */}
      <image
        x={building.x}
        y={building.y}
        width={building.width}
        height={building.height}
        href={`/image/floor${floorNum || 1}.png`}
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
                y={room.y + room.height / 2 - ((arr.length - 1) * 7) + i * 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isActive ? 9.5 : 8.5}
                fontWeight={isActive ? "700" : "500"}
                fill={isActive ? "#1565c0" : "#5d7186"}
                fontFamily="inherit"
                style={{ pointerEvents: "none" }}
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
  );
}

export default function FloorPlanTooltip({ roomId, roomName, children, mode = "hover", onSelectRoom, floor }) {
  const boxRef = useRef(null);
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [roomLocations, setRoomLocations] = useState({});
  const [dynamicRoomFloor, setDynamicRoomFloor] = useState(ROOM_FLOOR);
  const [dynamicFloorPlans, setDynamicFloorPlans] = useState(FLOOR_PLANS);

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

    // Center tooltip on screen
    const tooltipWidth = 480;
    const tooltipHeight = 300; // Approximate height
    
    const newPosition = {
      top: Math.max(20, (window.innerHeight - tooltipHeight) / 2 + window.scrollY),
      left: Math.max(20, (window.innerWidth - tooltipWidth) / 2 + window.scrollX)
    };

    setPosition(newPosition);
  }, [show]);

  if (!floorData) {
    return children;
  }

  const handleMouseEnter = (e) => {
    if (isSelectMode) return; // Don't auto-show in select mode
    setShow(true);
  };

  const handleMouseLeave = (e) => {
    if (isSelectMode) return; // Don't auto-hide in select mode
    setShow(false);
  };

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
          />
        </div>
      ) : (
        <span
          ref={boxRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            display: "inline-block",
            cursor: "pointer",
            borderBottom: "1px dotted #1976d2",
            position: "relative",
            minWidth: "auto",
            padding: "2px 4px"
          }}
        >
          {children}
        </span>
      )}

      {show && !isSelectMode && ReactDOM.createPortal(
        <Paper
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          elevation={12}
          sx={{
            position: "fixed",
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: 480,
            p: 3,
            borderRadius: "10px",
            border: "1px solid #d8dfe7",
            backgroundColor: "#ffffff",
            boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
            zIndex: 99999,
            pointerEvents: "auto",
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
              fontSize: "14px",
              mb: 1,
            }}
          >
            Floor {floorNum} · Location
          </Typography>
          <FloorPlanSVG 
            floorData={floorData}
            floorNum={floorNum}
            activeRoomId={id}
            isSelectable={false}
            roomLocations={roomLocations}
          />
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              color: "#1976d2",
              fontWeight: 600,
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            {roomName}
          </Typography>
        </Paper>,
        document.body
      )}
    </>
  );
}
