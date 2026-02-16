CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback" text NOT NULL,
	"user_agent" varchar(512),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
