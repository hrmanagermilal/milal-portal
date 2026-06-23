import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Popper from "@mui/material/Popper";
import Fade from "@mui/material/Fade";

/**
 * Temporary building floor plan layout.
 *
 * Floor 1 rooms: Small Meeting Room-1, Small Meeting Room-2, Practice Room, Lounge
 * Floor 2 rooms: Main Conference Room, Studio, Medium Conference Room
 *
 * Coordinates are within an SVG viewBox of "0 0 320 200"
 */
const FLOOR_PLANS = {
  1: {
    viewBox: "0 0 320 210",
    building: { x: 8, y: 8, width: 304, height: 194 },
    rooms: [
      {
        key: "Small Meeting Room-1",
        label: "Small\nMeeting-1",
        x: 18, y: 20, width: 82, height: 72,
      },
      {
        key: "Small Meeting Room-2",
        label: "Small\nMeeting-2",
        x: 114, y: 20, width: 82, height: 72,
      },
      {
        key: "Practice Room",
        label: "Practice\nRoom",
        x: 210, y: 20, width: 92, height: 72,
      },
      {
        key: "Lounge",
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
        key: "Main Conference Room",
        label: "Main\nConf. Room",
        x: 18, y: 20, width: 176, height: 90,
      },
      {
        key: "Studio",
        label: "Studio",
        x: 208, y: 20, width: 94, height: 90,
      },
      {
        key: "Medium Conference Room",
        label: "Medium\nConf. Room",
        x: 18, y: 124, width: 176, height: 72,
      },
    ],
    corridors: [
      { x: 18, y: 114, width: 284, height: 6 },
    ],
  },
};

/** Map room name → floor number */
const ROOM_FLOOR = {
  "Main Conference Room": 2,
  "Small Meeting Room-1": 1,
  "Small Meeting Room-2": 1,
  "Studio": 2,
  "Practice Room": 1,
  "Medium Conference Room": 2,
  "Lounge": 1,
};

function FloorPlanSVG({ floorData, activeRoomKey }) {
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
        const isActive = room.key === activeRoomKey;
        return (
          <g key={room.key}>
            <rect
              x={room.x} y={room.y}
              width={room.width} height={room.height}
              rx={3} ry={3}
              fill={isActive ? "rgba(25,118,210,0.22)" : "#e8edf5"}
              stroke={isActive ? "#1976d2" : "#a8b8cc"}
              strokeWidth={isActive ? 2 : 1}
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

export default function FloorPlanTooltip({ roomName, children }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const floor = ROOM_FLOOR[roomName];
  const floorData = floor ? FLOOR_PLANS[floor] : null;

  if (!floorData) return children;

  const open = Boolean(anchorEl);

  return (
    <Box
      onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
      onMouseLeave={() => setAnchorEl(null)}
      sx={{ display: "inline-block", cursor: "default" }}
    >
      {children}

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="right-start"
        transition
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
        style={{ zIndex: 1400 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={160}>
            <Paper
              elevation={6}
              sx={{
                width: 240,
                p: 1.5,
                borderRadius: "10px",
                border: "1px solid #d8dfe7",
                pointerEvents: "none",
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
                Floor {floor} · Location
              </Typography>
              <FloorPlanSVG floorData={floorData} activeRoomKey={roomName} />
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
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}
