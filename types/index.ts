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
