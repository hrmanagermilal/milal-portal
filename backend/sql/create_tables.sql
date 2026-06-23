-- ============================================================
-- Milal Room Reservation - Database Schema (MySQL)
-- ============================================================

-- Drop existing tables (order matters due to foreign key)
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS rooms;

-- ============================================================
-- Table: rooms
-- ============================================================
CREATE TABLE rooms (
    id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    capacity    INT          NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    floor       INT          NOT NULL DEFAULT 1,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1
);

-- ============================================================
-- Table: reservations
-- ============================================================
CREATE TABLE reservations (
    id             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id        INT          NOT NULL,
    requester_name VARCHAR(100) NOT NULL,
    phone          VARCHAR(30)  NOT NULL,
    email          VARCHAR(255) NOT NULL,
    purpose        VARCHAR(255) NOT NULL,
    attendees      INT          NOT NULL DEFAULT 1,
    notes          TEXT         NOT NULL,
    start_time     DATETIME     NOT NULL,
    end_time       DATETIME     NOT NULL,
    status         ENUM('pending','approved','changed','rejected') NOT NULL DEFAULT 'pending',
    admin_comment  TEXT         NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Seed Data: Rooms
-- ============================================================
INSERT INTO rooms (name, capacity, description, floor, is_active) VALUES
    ('Main Conference Room',   24, 'Projector, WIFI, Mic/Speaker',      2, 1),
    ('Small Meeting Room-1',    8, 'Whiteboard, WIFI',                  1, 1),
    ('Small Meeting Room-2',    6, '60-inch TV, WIFI',                  1, 1),
    ('Studio',                 10, 'Video recording and profile shoot',  2, 1),
    ('Practice Room',          12, 'Max 2 hours reservation',           1, 1),
    ('Medium Conference Room', 12, '80-inch TV, WIFI',                  2, 1),
    ('Lounge',                 16, 'Meal and rest area',                1, 1);

