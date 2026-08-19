-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: milal_room_reservation
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cell_report_member_entries`
--

DROP TABLE IF EXISTS `cell_report_member_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cell_report_member_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `member_id` int NOT NULL,
  `attended` tinyint(1) NOT NULL,
  `attendance_type` enum('present','absent','long_absence') NOT NULL,
  `prayer` text NOT NULL,
  `remarks` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `report_id` (`report_id`),
  KEY `member_id` (`member_id`),
  KEY `ix_cell_report_member_entries_id` (`id`),
  CONSTRAINT `cell_report_member_entries_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `cell_reports` (`id`),
  CONSTRAINT `cell_report_member_entries_ibfk_2` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cell_reports`
--

DROP TABLE IF EXISTS `cell_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cell_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leader_member_id` int NOT NULL,
  `cell_group` varchar(20) NOT NULL,
  `meeting_date` date NOT NULL,
  `meeting_time` varchar(20) NOT NULL,
  `meeting_place` varchar(255) NOT NULL,
  `overall_prayer` text NOT NULL,
  `leader_comment` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `leader_member_id` (`leader_member_id`),
  KEY `ix_cell_reports_id` (`id`),
  CONSTRAINT `cell_reports_ibfk_1` FOREIGN KEY (`leader_member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_change_logs`
--

DROP TABLE IF EXISTS `member_change_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `changed_at` datetime NOT NULL,
  `changed_by` varchar(100) NOT NULL,
  `field_name` varchar(50) NOT NULL,
  `old_value` text NOT NULL,
  `new_value` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `ix_member_change_logs_id` (`id`),
  CONSTRAINT `member_change_logs_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `family_id` int DEFAULT NULL,
  `family_relation` varchar(50) NOT NULL,
  `family_head_name` varchar(100) NOT NULL,
  `gender` varchar(1) NOT NULL,
  `birth_year` int DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `title` varchar(50) NOT NULL,
  `position_code` int DEFAULT NULL,
  `position_order` int DEFAULT NULL,
  `church_level_name` varchar(50) NOT NULL,
  `church_level_code` int DEFAULT NULL,
  `church_level_order` int DEFAULT NULL,
  `church_level_date` date DEFAULT NULL,
  `church_level_church` varchar(100) NOT NULL,
  `member_category1_code` int DEFAULT NULL,
  `member_category1_name` varchar(50) NOT NULL,
  `member_category2_code` int DEFAULT NULL,
  `member_category2_name` varchar(50) NOT NULL,
  `member_category_updated_at` date DEFAULT NULL,
  `membership_status` varchar(20) NOT NULL,
  `group_category_name` varchar(100) NOT NULL,
  `cell_group` varchar(100) NOT NULL,
  `postal_code_jibun` varchar(20) NOT NULL,
  `postal_code_road` varchar(20) NOT NULL,
  `address` varchar(255) NOT NULL,
  `address_detail` varchar(255) NOT NULL,
  `address_road` varchar(255) NOT NULL,
  `photo_url` varchar(500) NOT NULL,
  `user_id` varchar(30) NOT NULL,
  `permission` varchar(20) NOT NULL,
  `accessible` int NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `welcomed_at` date DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `custom_1` varchar(255) NOT NULL,
  `custom_2` varchar(255) NOT NULL,
  `custom_3` varchar(255) NOT NULL,
  `custom_4` varchar(255) NOT NULL,
  `custom_5` varchar(255) NOT NULL,
  `custom_6` varchar(255) NOT NULL,
  `custom_7` varchar(255) NOT NULL,
  `custom_8` varchar(255) NOT NULL,
  `custom_9` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_members_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=950557 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `code` varchar(4) NOT NULL,
  `contact` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `ix_otp_codes_id` (`id`),
  CONSTRAINT `otp_codes_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reservation_rules`
--

DROP TABLE IF EXISTS `reservation_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reservation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` int NOT NULL,
  `rule_type` enum('day_of_week','specific_date') NOT NULL,
  `day_of_week` int DEFAULT NULL,
  `specific_date` date DEFAULT NULL,
  `membership_category` enum('youth','adult') DEFAULT NULL,
  `applies_all_day` tinyint(1) NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `is_allowed` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `room_id` (`room_id`),
  KEY `ix_reservation_rules_id` (`id`),
  CONSTRAINT `reservation_rules_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reservations`
--

DROP TABLE IF EXISTS `reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reservations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` int NOT NULL,
  `requester_name` varchar(100) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `email` varchar(255) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `attendees` int NOT NULL,
  `notes` text NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` enum('pending','approved','changed','rejected') NOT NULL,
  `admin_comment` text NOT NULL,
  `repeat_type` varchar(20) NOT NULL,
  `repeat_count` int NOT NULL,
  `parent_reservation_id` int DEFAULT NULL,
  `start_reminder_sent` tinyint(1) NOT NULL,
  `start_reminder_sent_at` datetime DEFAULT NULL,
  `end_reminder_sent` tinyint(1) NOT NULL,
  `end_reminder_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `room_id` (`room_id`),
  KEY `parent_reservation_id` (`parent_reservation_id`),
  KEY `ix_reservations_id` (`id`),
  CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `reservations_ibfk_2` FOREIGN KEY (`parent_reservation_id`) REFERENCES `reservations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `room_locations`
--

DROP TABLE IF EXISTS `room_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `room_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` int NOT NULL,
  `x1` float NOT NULL,
  `y1` float NOT NULL,
  `x2` float NOT NULL,
  `y2` float NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_id` (`room_id`),
  KEY `ix_room_locations_id` (`id`),
  CONSTRAINT `room_locations_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rooms`
--

DROP TABLE IF EXISTS `rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `capacity` int NOT NULL,
  `description` varchar(255) NOT NULL,
  `floor` int NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `ix_rooms_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `membership_category` enum('youth','adult') NOT NULL,
  `created_at` datetime NOT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_id` (`member_id`),
  KEY `ix_users_id` (`id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-17 13:13:46
