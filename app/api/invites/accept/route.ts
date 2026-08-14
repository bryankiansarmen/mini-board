import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { acceptInviteCode } from "@/lib/invites/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let code: string;
  try {
    const body = await request.json();
    code = String(body?.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "code is required." }, { status: 400 });
  }

  const result = await acceptInviteCode(createServiceClient(), {
    code,
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { workspaceId: result.workspaceId, workspaceName: result.workspaceName },
    { status: 200 },
  );
}