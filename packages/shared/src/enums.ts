// Domain vocabulary shared by web, API and worker. Growth OS names are kept as they are;
// only the AI is called "Genie Assistant". Changing a value here is a data migration.

export const ROLES = ["owner", "manager", "creative", "sales", "finance", "hr", "freelancer", "client"] as const;
export type Role = (typeof ROLES)[number];

/** Growth OS Client Fitment Map: effort to serve vs return. */
export const FITMENT_QUADRANTS = ["Amazing", "Bread-winning", "Convenience", "Dangerous"] as const;
export type FitmentQuadrant = (typeof FITMENT_QUADRANTS)[number];

export const BUSINESS_STAGES = ["Struggle", "Survival", "Stability", "Success", "Scale"] as const;
export type BusinessStage = (typeof BUSINESS_STAGES)[number];

export const BUSINESS_FUNCTIONS = ["Marketing", "Sales", "Operations / delivery", "R&D", "Accounts & Finance", "HR", "Management"] as const;

export const LIFECYCLE_PHASES = ["win", "onboard", "plan", "produce", "deliver"] as const;
export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

export const CONTENT_STAGES = ["idea", "topic", "research", "script", "approval", "ready"] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];

export const VIDEO_STAGES = [
  "Planned",
  "Scripting",
  "Shoot Scheduled",
  "Shot",
  "Editing",
  "Internal QC",
  "Client Review",
  "Revision",
  "Approved",
  "Published",
] as const;
export type VideoStage = (typeof VIDEO_STAGES)[number];

export const EDIT_STEPS = ["Rough cut", "Video analyse", "B-rolls", "Text", "Colour corrections", "Transitions", "BGM", "Spelling", "Final overview"] as const;

export const REVISION_KINDS = ["agency-correction", "included-revision", "change-request"] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

/** STOP review rhythm: Strategic (45 days), Tactical (14 days), weekly, Operational (daily). */
export const REVIEW_CADENCES = ["daily", "weekly", "tactical", "strategic"] as const;
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];

export const PLATFORMS = ["instagram", "facebook", "youtube", "linkedin", "x", "threads", "pinterest", "gbp"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const QUESTION_TYPES = ["text", "long", "number", "currency", "choice", "multi", "yesno", "rating", "table", "file"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Questionnaire sections are either needed before work starts, or completed within the agency's window (default 7 days). */
export const SECTION_WHEN = ["required", "within-window"] as const;
export type SectionWhen = (typeof SECTION_WHEN)[number];
