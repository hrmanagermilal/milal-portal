-- ============================================================
-- Milal Community - Database Schema (MySQL)
-- ============================================================

-- Drop existing tables (order matters due to foreign key)
DROP TABLE IF EXISTS cell_report_member_entries;
DROP TABLE IF EXISTS cell_reports;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS room_locations;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS member_change_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS members;

-- ============================================================
-- Table: members  (church directory)
-- ============================================================
CREATE TABLE members (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    car_plate VARCHAR(50)  NOT NULL DEFAULT '',
    phone        VARCHAR(30)  NOT NULL DEFAULT '',
    address      VARCHAR(255) NOT NULL DEFAULT '',
    email        VARCHAR(255) NOT NULL DEFAULT '',
    title        VARCHAR(12) NOT NULL DEFAULT '',
    cell_group   VARCHAR(20) NOT NULL DEFAULT '',
    user_id      VARCHAR(30)  NOT NULL DEFAULT '',
    permission   ENUM('member','admin') NOT NULL DEFAULT 'member'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Table: users  (accounts linked to members)
-- ============================================================
CREATE TABLE users (
    id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id     INT          NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_member FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============================================================
-- Table: otp_codes  (temporary verification codes)
-- ============================================================
CREATE TABLE otp_codes (
    id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id  INT          NOT NULL,
    code       VARCHAR(4)   NOT NULL,
    contact    VARCHAR(255) NOT NULL,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_member FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============================================================
-- Table: member_change_logs
-- ============================================================
CREATE TABLE member_change_logs (
    id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id   INT          NOT NULL,
    changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by  VARCHAR(100) NOT NULL,
    field_name  VARCHAR(50)  NOT NULL,
    old_value   TEXT         NOT NULL,
    new_value   TEXT         NOT NULL,
    CONSTRAINT fk_change_log_member FOREIGN KEY (member_id) REFERENCES members(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
-- Table: room_locations (floor plan coordinates)
-- ============================================================
CREATE TABLE room_locations (
    id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id     INT          NOT NULL UNIQUE,
    x1          FLOAT        NOT NULL,
    y1          FLOAT        NOT NULL,
    x2          FLOAT        NOT NULL,
    y2          FLOAT        NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_location_room FOREIGN KEY (room_id) REFERENCES rooms(id)
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
    repeat_type    VARCHAR(20)  NOT NULL DEFAULT 'none',  -- 'none', 'weekly', 'monthly'
    repeat_count   INT          NOT NULL DEFAULT 1,  -- number of times to repeat
    parent_reservation_id INT,  -- for grouping repeat instances
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id),
    CONSTRAINT fk_parent_reservation FOREIGN KEY (parent_reservation_id) REFERENCES reservations(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Table: cell_reports
-- ============================================================
CREATE TABLE cell_reports (
    id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    leader_member_id INT          NOT NULL,
    cell_group       VARCHAR(20)  NOT NULL,
    meeting_date     DATE         NOT NULL,
    meeting_time     VARCHAR(20)  NOT NULL DEFAULT '',
    meeting_place    VARCHAR(255) NOT NULL DEFAULT '',
    overall_prayer   TEXT         NOT NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cell_report_leader FOREIGN KEY (leader_member_id) REFERENCES members(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Table: cell_report_member_entries
-- ============================================================
CREATE TABLE cell_report_member_entries (
    id         INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
    report_id  INT         NOT NULL,
    member_id  INT         NOT NULL,
    attended   TINYINT(1)  NOT NULL DEFAULT 0,
    prayer     TEXT        NOT NULL,
    CONSTRAINT fk_cell_report_entry_report FOREIGN KEY (report_id) REFERENCES cell_reports(id),
    CONSTRAINT fk_cell_report_entry_member FOREIGN KEY (member_id) REFERENCES members(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Seed Data: Rooms
-- ============================================================
INSERT INTO rooms (name, capacity, description, floor, is_active) VALUES
    ('Room 2-1',   24, 'Projector, WIFI, Mic/Speaker',      2, 1),
    ('Room 1-1',    8, 'Whiteboard, WIFI',                  1, 1),
    ('Room 1-2',    6, '60-inch TV, WIFI',                  1, 1),
    ('Room 2-2',                 10, 'Video recording and profile shoot',  2, 1),
    ('Room 1-3',          12, 'Max 2 hours reservation',           1, 1),
    ('Room 2-3', 12, '80-inch TV, WIFI',                  2, 1),
    ('Room 1-4',                 16, 'Meal and rest area',                1, 1);

