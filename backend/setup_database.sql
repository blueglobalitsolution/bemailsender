-- Run this SQL script to create the database and user for local development
-- Execute: mysql -u root -p < setup_database.sql

CREATE DATABASE IF NOT EXISTS bemailerdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'bemailuser'@'localhost' IDENTIFIED BY 'befullfill786';
GRANT ALL PRIVILEGES ON bemailerdb.* TO 'bemailuser'@'localhost';
FLUSH PRIVILEGES;