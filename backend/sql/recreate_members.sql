DROP TABLE IF EXISTS cell_report_member_entries;
DROP TABLE IF EXISTS cell_reports;
DROP TABLE IF EXISTS member_change_logs;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS members;

CREATE TABLE members (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL DEFAULT '',
    phone        VARCHAR(30)  NOT NULL DEFAULT '',
    
    family_id    INT          DEFAULT NULL,
    family_relation VARCHAR(50) NOT NULL DEFAULT '',
    family_head_name VARCHAR(100) NOT NULL DEFAULT '',
    
    gender       VARCHAR(1)   NOT NULL DEFAULT '',
    birth_year   INT          DEFAULT NULL,
    birth_date   DATE         DEFAULT NULL,
    
    title        VARCHAR(50)  NOT NULL DEFAULT '',
    position_code INT         DEFAULT NULL,
    position_order INT        DEFAULT NULL,
    
    church_level_name VARCHAR(50) NOT NULL DEFAULT '',
    church_level_code INT      DEFAULT NULL,
    church_level_order INT     DEFAULT NULL,
    church_level_date DATE     DEFAULT NULL,
    church_level_church VARCHAR(100) NOT NULL DEFAULT '',
    
    member_category1_code INT  DEFAULT NULL,
    member_category1_name VARCHAR(50) NOT NULL DEFAULT '',
    member_category2_code INT  DEFAULT NULL,
    member_category2_name VARCHAR(50) NOT NULL DEFAULT '',
    member_category_updated_at DATE DEFAULT NULL,
    membership_status VARCHAR(20) NOT NULL DEFAULT '',
    
    group_category_name VARCHAR(100) NOT NULL DEFAULT '',
    cell_group   VARCHAR(100) NOT NULL DEFAULT '',
    
    postal_code_jibun VARCHAR(20) NOT NULL DEFAULT '',
    postal_code_road VARCHAR(20) NOT NULL DEFAULT '',
    address      VARCHAR(255) NOT NULL DEFAULT '',
    address_detail VARCHAR(255) NOT NULL DEFAULT '',
    address_road VARCHAR(255) NOT NULL DEFAULT '',
    
    photo_url    VARCHAR(500) NOT NULL DEFAULT '',
    
    user_id      VARCHAR(30)  NOT NULL DEFAULT '',
    permission   VARCHAR(20)  NOT NULL DEFAULT 'member',
    accessible   TINYINT(1)   NOT NULL DEFAULT 0,
    
    created_at   DATETIME     DEFAULT NULL,
    welcomed_at  DATE         DEFAULT NULL,
    updated_at   DATETIME     DEFAULT NULL,
    
    custom_1     VARCHAR(255) NOT NULL DEFAULT '',
    custom_2     VARCHAR(255) NOT NULL DEFAULT '',
    custom_3     VARCHAR(255) NOT NULL DEFAULT '',
    custom_4     VARCHAR(255) NOT NULL DEFAULT '',
    custom_5     VARCHAR(255) NOT NULL DEFAULT '',
    custom_6     VARCHAR(255) NOT NULL DEFAULT '',
    custom_7     VARCHAR(255) NOT NULL DEFAULT '',
    custom_8     VARCHAR(255) NOT NULL DEFAULT '',
    custom_9     VARCHAR(255) NOT NULL DEFAULT ''
    
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE users (
    id                    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id             INT          NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    membership_category   ENUM('youth','adult') NOT NULL DEFAULT 'adult',
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_member FOREIGN KEY (member_id) REFERENCES members(id)
);

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
