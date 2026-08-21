export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
};

export type MemberListItem = {
  user_id: string;
  email: string | null;
  role: "admin" | "member";
  joined_at: string;
};

export type WorkspaceInviteCodeRow = {
  id: string;
  workspace_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  created_at: string;
};

export type BoardRow = {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
  created_at: string;
};

export type ColumnRow = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
};

export type CardRow = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  assignee_id: string | null;
  labels: string[];
  created_at: string;
  updated_at: string;
};

export type ChecklistItemRow = {
  id: string;
  card_id: string;
  content: string;
  is_complete: boolean;
  position: number;
  created_at: string;
};

export type CommentRow = {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type ActivityLogRow = {
  id: string;
  board_id: string;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
