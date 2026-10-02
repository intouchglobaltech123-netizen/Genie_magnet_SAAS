// Projects and tasks (P5-21): work that is not a video — a website, an event, a new person's joining — as projects of
// tasks, each with one person accountable, a due day and the task it waits for; and tasks on their own, including the
// commitments made in reviews carried forward as tasks. The agency keeps task lists to start projects from; its
// "joining" list becomes each new person's joining project when they accept their invitation.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const day = z.iso.date("Pick the day");
const person = z.string().min(1, "Choose the person").max(64);

export const PROJECT_STATUSES = ["active", "on_hold", "done", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { active: "Active", on_hold: "On hold", done: "Done", cancelled: "Cancelled" };

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = { high: "High", medium: "Medium", low: "Low" };

/** Where a task came from. */
export const TASK_SOURCES = ["manual", "template", "joining", "commitment"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const projectInput = z
  .object({
    name: text(160).min(2, "Name the project"),
    clientId: z.uuid().nullable().default(null),
    ownerId: person,
    description: text(2000).default(""),
    startOn: day.nullable().default(null),
    dueOn: day.nullable().default(null),
    status: z.enum(PROJECT_STATUSES).default("active"),
    /** Start from one of the agency's task lists (only when it is created). */
    templateKey: z.string().max(40).nullable().default(null),
  })
  .refine((p) => !p.startOn || !p.dueOn || p.dueOn >= p.startOn, { path: ["dueOn"], message: "Not before it starts" });
export type ProjectInput = z.input<typeof projectInput>;

export const taskInput = z.object({
  title: text(200).min(2, "Say what is to be done"),
  notes: text(2000).default(""),
  projectId: z.uuid().nullable().default(null),
  ownerId: person,
  dueOn: day.nullable().default(null),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  /** Another task of the same project that has to be done first. */
  dependsOnId: z.uuid().nullable().default(null),
});
export type TaskInput = z.input<typeof taskInput>;

export const taskStatusInput = z.object({ status: z.enum(TASK_STATUSES) });

// ─── Task lists ───────────────────────────────────────────────────────

/** Who a task in a list goes to: the project's owner, or the person joining (in the joining list). */
export const TEMPLATE_ASSIGNEES = ["owner", "joiner"] as const;
export type TemplateAssignee = (typeof TEMPLATE_ASSIGNEES)[number];

export const projectTemplate = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/, "Lowercase letters, numbers and _"),
  name: text(80).min(2, "Name the list"),
  tasks: z
    .array(
      z.object({
        title: text(200).min(2, "Say what is to be done"),
        /** Due this many days after the project starts (the joining day, for the joining list). */
        days: z.number().int().min(-60).max(365).default(0),
        to: z.enum(TEMPLATE_ASSIGNEES).default("owner"),
        /** The task in this list (by its place, from 1) that has to be done first. */
        after: z.number().int().min(1).max(60).nullable().default(null),
      }),
    )
    .min(1, "Add at least one task")
    .max(60),
});
export type ProjectTemplate = z.output<typeof projectTemplate>;

export const projectSettingsInput = z.object({ templates: z.array(projectTemplate).max(30) }).superRefine((s, ctx) => {
  const seen = new Set<string>();
  s.templates.forEach((t, i) => {
    if (seen.has(t.key)) ctx.addIssue({ code: "custom", path: ["templates", i, "key"], message: "Each list needs its own key" });
    seen.add(t.key);
    t.tasks.forEach((x, j) => {
      if (x.after !== null && (x.after > t.tasks.length || x.after === j + 1))
        ctx.addIssue({ code: "custom", path: ["templates", i, "tasks", j, "after"], message: "Pick another task in this list" });
      if (x.to === "joiner" && t.key !== JOINING_TEMPLATE)
        ctx.addIssue({ code: "custom", path: ["templates", i, "tasks", j, "to"], message: "Only the joining list has a joiner" });
    });
  });
});
export type ProjectSettingsInput = z.input<typeof projectSettingsInput>;

/** The list each new person's joining project is made from. */
export const JOINING_TEMPLATE = "joining";

export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: JOINING_TEMPLATE,
    name: "Joining",
    tasks: [
      { title: "Collect the documents: ID and address proof, PAN, bank details, photos", days: 0, to: "owner", after: null },
      { title: "Set up the email, the team's WhatsApp group and the app sign-in", days: 0, to: "owner", after: null },
      { title: "Hand over the laptop and equipment from the register", days: 0, to: "owner", after: null },
      { title: "Walk through the SOPs and checklists for the role", days: 2, to: "owner", after: null },
      { title: "Read the SOPs for your role and say you have", days: 3, to: "joiner", after: 4 },
      { title: "Set the KRAs and the first month's goals", days: 7, to: "owner", after: null },
      { title: "First-month review", days: 30, to: "owner", after: 6 },
    ],
  },
  {
    key: "one_off",
    name: "One-off client project",
    tasks: [
      { title: "Agree the brief and what will be delivered", days: 0, to: "owner", after: null },
      { title: "Plan, quote and get the go-ahead", days: 3, to: "owner", after: 1 },
      { title: "Make it", days: 14, to: "owner", after: 2 },
      { title: "Client review", days: 17, to: "owner", after: 3 },
      { title: "Changes and hand-over", days: 21, to: "owner", after: 4 },
    ],
  },
];

// ─── What the API returns ─────────────────────────────────────────────

export interface ProjectPerson {
  id: string;
  name: string | null;
}

/** GET /tasks (one item) */
export interface TaskRow {
  id: string;
  title: string;
  notes: string;
  project: { id: string; name: string } | null;
  owner: ProjectPerson;
  createdBy: ProjectPerson | null;
  dueOn: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  overdue: boolean;
  /** The task it waits for, and whether that is done. */
  waitsFor: { id: string; title: string; done: boolean } | null;
  /** Waiting for a task that is not done yet. */
  blocked: boolean;
  source: TaskSource;
  commitmentId: string | null;
  completedAt: string | null;
  completedBy: ProjectPerson | null;
  createdAt: string;
}

/** GET /projects (one item) */
export interface ProjectRow {
  id: string;
  name: string;
  client: { id: string; name: string } | null;
  owner: ProjectPerson;
  /** The person a joining project is about. */
  joiner: ProjectPerson | null;
  description: string;
  startOn: string | null;
  dueOn: string | null;
  status: ProjectStatus;
  progress: { total: number; done: number; overdue: number; blocked: number };
  createdAt: string;
}

/** GET /projects/:id */
export interface ProjectDetail extends ProjectRow {
  tasks: TaskRow[];
}
