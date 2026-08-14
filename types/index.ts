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
