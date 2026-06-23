-- ============================================================
-- Milal Portal - Database Schema (MySQL)
-- ============================================================

-- Drop existing tables (order matters due to foreign key)
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS members;

-- ============================================================
-- Table: members  (church directory)
-- ============================================================
CREATE TABLE members (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    offering_num VARCHAR(50)  NOT NULL DEFAULT '',
    phone        VARCHAR(30)  NOT NULL DEFAULT '',
    address      VARCHAR(255) NOT NULL DEFAULT '',
    email        VARCHAR(255) NOT NULL DEFAULT ''
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
-- Seed Data: Members
-- ============================================================
INSERT INTO members (name, offering_num, phone, address, email) VALUES
    ('James Kim',      'M001', '010-1001-2001', '123 Gangnam-gu, Seoul',    'james.kim@example.com'),
    ('Sarah Park',     'M002', '010-1002-2002', '456 Seocho-gu, Seoul',     'sarah.park@example.com'),
    ('David Lee',      'M003', '010-1003-2003', '789 Mapo-gu, Seoul',       'david.lee@example.com'),
    ('Emily Choi',     'M004', '010-1004-2004', '101 Yongsan-gu, Seoul',    'emily.choi@example.com'),
    ('Michael Yoon',   'M005', '010-1005-2005', '202 Jongno-gu, Seoul',     'michael.yoon@example.com'),
    ('Rachel Jung',    'M006', '010-1006-2006', '303 Dongdaemun-gu, Seoul', 'rachel.jung@example.com'),
    ('Daniel Han',     'M007', '010-1007-2007', '404 Seongbuk-gu, Seoul',   'daniel.han@example.com'),
    ('Grace Shin',     'M008', '010-1008-2008', '505 Nowon-gu, Seoul',      'grace.shin@example.com'),
    ('Andrew Cho',     'M009', '010-1009-2009', '606 Gwanak-gu, Seoul',     'andrew.cho@example.com'),
    ('Linda Oh',       'M010', '010-1010-2010', '707 Dobong-gu, Seoul',     'linda.oh@example.com'),
    ('Steven Kwon',    'M011', '010-1011-2011', '808 Eunpyeong-gu, Seoul',  'steven.kwon@example.com'),
    ('Jennifer Lim',   'M012', '010-1012-2012', '909 Mapo-gu, Seoul',       'jennifer.lim@example.com'),
    ('Christopher Bae','M013', '010-1013-2013', '111 Gangbuk-gu, Seoul',    'chris.bae@example.com'),
    ('Amanda Song',    'M014', '010-1014-2014', '222 Jungnang-gu, Seoul',   'amanda.song@example.com'),
    ('Kevin Moon',     'M015', '010-1015-2015', '333 Gangseo-gu, Seoul',    'kevin.moon@example.com');

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

