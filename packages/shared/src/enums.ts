// Domain vocabulary shared by web, API and worker. Growth OS names are kept as they are;
// only the AI is called "Genie Assistant". Changing a value here is a data migration.

/**
 * Default roles every new agency starts with. Agencies rename, copy and add roles in Settings (plan v1.1),
 * so a membership's role is any string; these keys are only the starting set.
 */
export const DEFAULT_ROLES = [
  "owner",
  "manager",
  "team_leader",
  "editor",
  "shooter",
  "script_writer",
  "social_media_manager",
  "finance",
  "hr",
  "freelancer",
  "client_approver",
  "client_viewer",
] as const;
export type DefaultRole = (typeof DEFAULT_ROLES)[number];

export const DEFAULT_ROLE_LABELS: Record<DefaultRole, string> = {
  owner: "Owner",
  manager: "Manager",
  team_leader: "Team leader",
  editor: "Editor",
  shooter: "Shooter",
  script_writer: "Script writer",
  social_media_manager: "Social media manager",
  finance: "Finance",
  hr: "HR",
  freelancer: "Freelancer",
  client_approver: "Client approver",
  client_viewer: "Client viewer",
};

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
export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  gbp: "Google Business Profile",
};

export const QUESTION_TYPES = ["text", "long", "number", "currency", "choice", "multi", "yesno", "rating", "table", "file"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Questionnaire sections are either needed before work starts, or completed within the agency's window (default 7 days). */
export const SECTION_WHEN = ["required", "within-window"] as const;
export type SectionWhen = (typeof SECTION_WHEN)[number];
