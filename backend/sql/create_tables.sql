-- ============================================================
-- Milal Community - Database Schema (MySQL)
-- ============================================================

-- Drop existing tables (order matters due to foreign key)
DROP TABLE IF EXISTS cell_report_member_entries;
DROP TABLE IF EXISTS cell_reports;
DROP TABLE IF EXISTS reservation_rules;
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
    id                    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id             INT          NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    membership_category   ENUM('youth','adult') NOT NULL DEFAULT 'adult',
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
-- Table: reservation_rules
-- ============================================================
CREATE TABLE reservation_rules (
    id                    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id               INT          NOT NULL,
    rule_type             ENUM('day_of_week','specific_date','membership_category') NOT NULL,
    day_of_week           INT,                     -- 0=Sunday, 1=Monday, ..., 6=Saturday
    specific_date         DATE,
    membership_category   ENUM('youth','adult'),
    is_allowed            TINYINT(1)   NOT NULL DEFAULT 1,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rule_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    leader_comment   TEXT,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cell_report_leader FOREIGN KEY (leader_member_id) REFERENCES members(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Table: cell_report_member_entries
-- ============================================================
CREATE TABLE cell_report_member_entries (
    id               INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
    report_id        INT         NOT NULL,
    member_id        INT         NOT NULL,
    attended         TINYINT(1)  NOT NULL DEFAULT 0,
    attendance_type  ENUM('present', 'absent', 'long_absence') NOT NULL DEFAULT 'absent',
    prayer           TEXT        NOT NULL,
    remarks          TEXT,
    CONSTRAINT fk_cell_report_entry_report FOREIGN KEY (report_id) REFERENCES cell_reports(id),
    CONSTRAINT fk_cell_report_entry_member FOREIGN KEY (member_id) REFERENCES members(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Seed Data: Rooms
-- ============================================================
SET NAMES utf8mb4;
INSERT INTO rooms (name, capacity, description, floor, is_active) VALUES 
('새가족실',20,'큰 테이블 2',1,1),
('청년부실',12,'청년부 전용',1,1),
('유치부실',25,'아이들 보호 매트, TV',1,1),
('부트캠프실',30,'작은 책상 10개, TV, 자체 음향시설',1,1),
('스튜디오',15,'찬양팀 악기, 음향',1,1),
('영유아부실',30,'보호매트, 어린이 책상 4개',1,1),
('친교실',150,'TV, 둥근테이블, 의자, 음향',1,1),
('주방',15,'조리시설',1,1),
('아동부 예배실',50,'어린이의자, 테이블 6개, 음향, TV',1,1),
('아동부-1',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-2',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-3',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-4',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-5',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-6',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-7',8,'어린이 테이블/의자, 화이트보드',1,1),
('아동부-8',8,'테이블',1,1),
('중보기도실-1',8,'테이블2, 화이트보드',1,1),
('중보기도실-2',15,'원형테이블2',1,1),
('간이회의실',10,'긴테이블2',1,1),
('자모실',10,'보호매트, 테이블없음',1,1),
('예배당',700,'예배시설',1,1),
('청소년부 예배실',100,'예배시설',2,1),
('챔버연습실',30,'테이블, 의자, 보면대',2,1),
('찬양대연습실-1',100,'피아노, 보면대, 의자',2,1),
('찬양대 연습실-2',100,'피아노, 보면대, 의자',2,1),
('카페테리아',150,'테이블, 싱크',2,1),
('소그룹모임-1',7,'원형테이블',2,1),
('소그룹모임-2',16,'원형테이블, TV',2,1),
('소그룹모임-3',10,'긴테이블',2,1),
('소그룹모임-4',8,'원형테이블, 화이트보드',2,1),
('소그룹모임-5',8,'원형테이블, 화이트보드',2,1),
('소그룹모임-6',8,'원형테이블, 화이트보드',2,1),
('소그룹모임-7',8,'원형테이블',2,1),
('소그룹모임-8',10,'긴테이블, 화이트보드',2,1),
('소예배실',50,'오픈공간, 예배시설',2,1);
