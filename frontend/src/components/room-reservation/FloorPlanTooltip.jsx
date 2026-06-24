import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

/**
 * Floor plan layout by room ID
 * Maps room ID → floor number, and displays floor layout
 */
const FLOOR_PLANS = {
  1: {
    viewBox: "0 0 320 210",
    building: { x: 8, y: 8, width: 304, height: 194 },
    rooms: [
      {
        id: 2,
        label: "Small\nMeeting-1",
        x: 18, y: 20, width: 82, height: 72,
      },
      {
        id: 3,
        label: "Small\nMeeting-2",
        x: 114, y: 20, width: 82, height: 72,
      },
      {
        id: 4,
        label: "Practice\nRoom",
        x: 210, y: 20, width: 92, height: 72,
      },
      {
        id: 5,
        label: "Lounge",
        x: 18, y: 110, width: 284, height: 76,
      },
    ],
    corridors: [
      { x: 18, y: 100, width: 284, height: 6 },
    ],
  },
  2: {
    viewBox: "0 0 320 210",
    building: { x: 8, y: 8, width: 304, height: 194 },
    rooms: [
      {
        id: 1,
        label: "Main\nConf. Room",
        x: 18, y: 20, width: 176, height: 90,
      },
      {
        id: 6,
        label: "Studio",
        x: 208, y: 20, width: 94, height: 90,
      },
      {
        id: 7,
        label: "Medium\nConf. Room",
        x: 18, y: 124, width: 176, height: 72,
      },
    ],
    corridors: [
      { x: 18, y: 114, width: 284, height: 6 },
    ],
  },
};

/** Map room ID → floor number */
const ROOM_FLOOR = {
  1: 2,  // Main Conference Room
  2: 1,  // Small Meeting Room-1
  3: 1,  // Small Meeting Room-2
  4: 1,  // Practice Room
  5: 1,  // Lounge
  6: 2,  // Studio
  7: 2,  // Medium Conference Room
};

function FloorPlanSVG({ floorData, activeRoomId, onSelectRoom, isSelectable }) {
  const { viewBox, building, rooms, corridors } = floorData;

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Building outline */}
      <rect
        x={building.x} y={building.y}
        width={building.width} height={building.height}
        rx={4} ry={4}
        fill="#f0f4fa"
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
      {rooms.map((room) => {
        const isActive = room.id === activeRoomId;
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
              stroke={isActive ? "#1976d2" : "#a8b8cc"}
              strokeWidth={isActive ? 2 : 1}
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
                e.currentTarget.style.stroke = isActive ? "#1976d2" : "#a8b8cc";
                e.currentTarget.style.strokeWidth = isActive ? "2" : "1";
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

  // Convert roomId to number if string
  const id = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;
  
  // In select mode, use provided floor prop; in hover mode, look up from ROOM_FLOOR
  const floorNum = mode === "select" ? floor : ROOM_FLOOR[id];
  const floorData = floorNum ? FLOOR_PLANS[floorNum] : null;

  const isSelectMode = mode === "select";

  useEffect(() => {
    if (!show || !boxRef.current) {
      return;
    }

    const rect = boxRef.current.getBoundingClientRect();

    const newPosition = {
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 10
    };

    // Adjust if goes off screen
    if (newPosition.left + 240 > window.innerWidth) {
      newPosition.left = rect.left + window.scrollX - 250;
    }
    if (newPosition.top + 300 > window.innerHeight) {
      newPosition.top = rect.top + window.scrollY - 200;
    }
    setPosition(newPosition);
  }, [show]);

  if (!floorData) {
    return children;
  }

  const handleMouseEnter = (e) => {
    if (isSelectMode) return; // Don't auto-show in select mode
    setPosition({ top: e.currentTarget.getBoundingClientRect().y + 5, left: e.currentTarget.getBoundingClientRect().x + 15 });
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
            activeRoomId={id} 
            onSelectRoom={handleSelectRoom}
            isSelectable={true}
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
            width: 240,
            p: 1.5,
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
              fontSize: "10px",
              mb: 0.5,
            }}
          >
            Floor {floorNum} · Location
          </Typography>
          <FloorPlanSVG 
            floorData={floorData} 
            activeRoomId={id}
            isSelectable={false}
          />
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.5,
              color: "#1976d2",
              fontWeight: 600,
              fontSize: "11px",
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
