CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`document_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`subtitle` text NOT NULL,
	`body` text NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`label` text NOT NULL,
	`source_pages` text NOT NULL,
	`raw_text` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`original_filename` text NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`total_cards` integer DEFAULT 0 NOT NULL,
	`processed_cards` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`chunk_strategy` text,
	`accent_color` text DEFAULT '#6366f1' NOT NULL,
	`created_at` text NOT NULL,
	`upload_object_path` text
);
--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`user_id` text NOT NULL,
	`document_id` text NOT NULL,
	`last_card_index` integer DEFAULT 0 NOT NULL,
	`last_card_id` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `document_id`),
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
