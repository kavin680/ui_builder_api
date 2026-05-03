-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `user_name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'ENGINEER', 'OPERATOR', 'VIEWER') NOT NULL DEFAULT 'ADMIN',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `refresh_token_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_configuration` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `max_reading_variables` INTEGER NOT NULL,
    `max_writing_variables` INTEGER NOT NULL,
    `alter_flag` BOOLEAN NOT NULL,
    `is_active` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `global_configuration_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_source_configuration` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `global_config_id` BIGINT NOT NULL,
    `type` ENUM('MQTT', 'SOCKET') NOT NULL,
    `host` VARCHAR(191) NULL,
    `port` INTEGER NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `qos` INTEGER NULL DEFAULT 0,
    `retain` BOOLEAN NULL DEFAULT false,
    `caPath` VARCHAR(191) NULL,
    `certPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `keyPath` VARCHAR(191) NULL,
    `protocol` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `data_source_configuration_global_config_id_key`(`global_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_source_topic` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_id` BIGINT NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `type` ENUM('SUBSCRIBE', 'PUBLISH') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `data_source_topic_config_id_fkey`(`config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_variable` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `global_config_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `sequence_no` INTEGER NOT NULL DEFAULT 0,
    `value` VARCHAR(100) NULL,
    `function_name` VARCHAR(100) NULL,
    `start_index` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `history_type` ENUM('NONE', 'INSTANT', 'ON_CHANGE', 'SCHEDULED', 'UTILITY') NOT NULL DEFAULT 'NONE',
    `last_run_at` DATETIME(3) NULL,
    `logging_time` INTEGER NULL,
    `next_run_at` DATETIME(3) NULL,

    INDEX `reading_variable_global_config_id_idx`(`global_config_id`),
    INDEX `reading_variable_global_config_id_sequence_no_idx`(`global_config_id`, `sequence_no`),
    INDEX `reading_variable_next_run_at_idx`(`next_run_at`),
    INDEX `reading_variable_is_active_history_type_idx`(`is_active`, `history_type`),
    INDEX `reading_variable_history_type_is_active_next_run_at_idx`(`history_type`, `is_active`, `next_run_at`),
    UNIQUE INDEX `reading_variable_global_config_id_name_key`(`global_config_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_variable_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `reading_variable_id` BIGINT NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reading_variable_history_reading_variable_id_recorded_at_idx`(`reading_variable_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_variable_utility_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `reading_variable_id` BIGINT NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reading_variable_utility_history_reading_variable_id_recorde_idx`(`reading_variable_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `writing_variable` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `global_config_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `sequence_no` INTEGER NOT NULL DEFAULT 0,
    `function_name` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `raw_value` VARCHAR(255) NULL,
    `value` DECIMAL(18, 2) NULL,
    `has_mbo` BOOLEAN NOT NULL DEFAULT false,

    INDEX `writing_variable_global_config_id_idx`(`global_config_id`),
    INDEX `writing_variable_global_config_id_sequence_no_idx`(`global_config_id`, `sequence_no`),
    UNIQUE INDEX `writing_variable_global_config_id_name_key`(`global_config_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `writing_variable_mbo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `writing_variable_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `value` DECIMAL(18, 2) NULL,
    `sequence_no` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `writing_variable_mbo_writing_variable_id_idx`(`writing_variable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `freeze_configuration` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `global_config_id` BIGINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `freeze_configuration_global_config_id_fkey`(`global_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `freeze_time_window` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `freeze_config_id` BIGINT NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `start_time` TIME(3) NOT NULL,
    `end_time` TIME(3) NOT NULL,

    INDEX `freeze_time_window_freeze_config_id_idx`(`freeze_config_id`),
    INDEX `freeze_time_window_dayOfWeek_idx`(`dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `writing_variable_freeze_map` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `writing_variable_id` BIGINT NOT NULL,
    `freeze_config_id` BIGINT NOT NULL,
    `value_on_start` DECIMAL(18, 2) NULL,
    `value_on_end` DECIMAL(18, 2) NULL,
    `last_start_triggered_at` DATETIME(3) NULL,
    `last_end_triggered_at` DATETIME(3) NULL,
    `next_start_run_at` DATETIME(3) NULL,
    `next_end_run_at` DATETIME(3) NULL,
    `mbo_variable_id` BIGINT NULL,

    INDEX `writing_variable_freeze_map_next_start_run_at_idx`(`next_start_run_at`),
    INDEX `writing_variable_freeze_map_next_end_run_at_idx`(`next_end_run_at`),
    INDEX `writing_variable_freeze_map_freeze_config_id_fkey`(`freeze_config_id`),
    INDEX `writing_variable_freeze_map_mbo_variable_id_fkey`(`mbo_variable_id`),
    UNIQUE INDEX `writing_variable_freeze_map_writing_variable_id_mbo_variable_key`(`writing_variable_id`, `mbo_variable_id`, `freeze_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alarms` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `reading_variable_id` BIGINT NOT NULL,
    `alarm_name` VARCHAR(100) NOT NULL,
    `condition_type` ENUM('>', '<', '>=', '<=', '==', '!=') NOT NULL,
    `threshold_value` DECIMAL(18, 2) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `alarms_reading_variable_id_fkey`(`reading_variable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alarm_status` (
    `alarm_id` BIGINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_acknowledged` BOOLEAN NOT NULL DEFAULT false,
    `active_since` DATETIME(3) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `cleared_at` DATETIME(3) NULL,

    PRIMARY KEY (`alarm_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alarm_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `alarm_id` BIGINT NOT NULL,
    `event_type` ENUM('I', 'IO', 'IA', 'IOA', 'IAO') NOT NULL,
    `event_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `value_at_event` VARCHAR(100) NOT NULL,
    `user_id` INTEGER NULL,

    INDEX `alarm_history_alarm_id_event_time_idx`(`alarm_id`, `event_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_source_configuration` ADD CONSTRAINT `data_source_configuration_global_config_id_fkey` FOREIGN KEY (`global_config_id`) REFERENCES `global_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_source_topic` ADD CONSTRAINT `data_source_topic_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `data_source_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_variable` ADD CONSTRAINT `reading_variable_global_config_id_fkey` FOREIGN KEY (`global_config_id`) REFERENCES `global_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_variable_history` ADD CONSTRAINT `reading_variable_history_reading_variable_id_fkey` FOREIGN KEY (`reading_variable_id`) REFERENCES `reading_variable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_variable_utility_history` ADD CONSTRAINT `reading_variable_utility_history_reading_variable_id_fkey` FOREIGN KEY (`reading_variable_id`) REFERENCES `reading_variable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `writing_variable` ADD CONSTRAINT `writing_variable_global_config_id_fkey` FOREIGN KEY (`global_config_id`) REFERENCES `global_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `writing_variable_mbo` ADD CONSTRAINT `writing_variable_mbo_writing_variable_id_fkey` FOREIGN KEY (`writing_variable_id`) REFERENCES `writing_variable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `freeze_configuration` ADD CONSTRAINT `freeze_configuration_global_config_id_fkey` FOREIGN KEY (`global_config_id`) REFERENCES `global_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `freeze_time_window` ADD CONSTRAINT `freeze_time_window_freeze_config_id_fkey` FOREIGN KEY (`freeze_config_id`) REFERENCES `freeze_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `writing_variable_freeze_map` ADD CONSTRAINT `writing_variable_freeze_map_freeze_config_id_fkey` FOREIGN KEY (`freeze_config_id`) REFERENCES `freeze_configuration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `writing_variable_freeze_map` ADD CONSTRAINT `writing_variable_freeze_map_mbo_variable_id_fkey` FOREIGN KEY (`mbo_variable_id`) REFERENCES `writing_variable_mbo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `writing_variable_freeze_map` ADD CONSTRAINT `writing_variable_freeze_map_writing_variable_id_fkey` FOREIGN KEY (`writing_variable_id`) REFERENCES `writing_variable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alarms` ADD CONSTRAINT `alarms_reading_variable_id_fkey` FOREIGN KEY (`reading_variable_id`) REFERENCES `reading_variable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alarm_status` ADD CONSTRAINT `alarm_status_alarm_id_fkey` FOREIGN KEY (`alarm_id`) REFERENCES `alarms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alarm_history` ADD CONSTRAINT `alarm_history_alarm_id_fkey` FOREIGN KEY (`alarm_id`) REFERENCES `alarms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
