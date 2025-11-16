import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { makeLoggedRequest } from "@/lib/oauth";

const ALTINN_PLATFORM_URL =
  process.env.ALTINN_PLATFORM_URL || "https://platform.altinn.no";

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromRequest(cookieHeader);

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    
    if (searchParams.get("instanceOwnerPartyId")) {
      params.instanceOwnerPartyId = searchParams.get("instanceOwnerPartyId")!;
    } else if (session.userInfo?.pid) {
      params.instanceOwnerPartyId = session.userInfo.pid;
    }

    const response = await makeLoggedRequest({
      method: "GET",
      url: `${ALTINN_PLATFORM_URL}/storage/api/v1/instances`,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
      params,
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.response?.data || error.message },
      { status: error.response?.status || 500 },
    );
  }
}

