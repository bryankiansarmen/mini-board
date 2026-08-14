import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { changeMemberRole } from "@/lib/members/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let workspaceId: string;
  let role: string;
  try {
    const body = await request.json();
    workspaceId = String(body?.workspaceId ?? "");
    role = String(body?.role ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!workspaceId || !role) {
    return NextResponse.json(
      { error: "workspaceId and role are required." },
      { status: 400 },
    );
  }

  const result = await changeMemberRole(createServiceClient(), {
    workspaceId,
    targetUserId: userId,
    callerId: user.id,
    role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ userId: result.userId, role: result.role });
}