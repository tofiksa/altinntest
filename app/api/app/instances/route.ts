import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { makeLoggedRequest } from "@/lib/oauth";

const ALTINN_ORG = process.env.ALTINN_ORG || "";
const ALTINN_APP_NAME = process.env.ALTINN_APP_NAME || "";
const ALTINN_APP_API_URL =
  ALTINN_ORG && ALTINN_APP_NAME
    ? `https://${ALTINN_ORG}.apps.altinn.no/${ALTINN_ORG}/${ALTINN_APP_NAME}`
    : null;

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromRequest(cookieHeader);

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!ALTINN_APP_API_URL) {
    return NextResponse.json(
      {
        error:
          "App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env",
      },
      { status: 400 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    
    if (searchParams.get("instanceOwnerPartyId")) {
      params.instanceOwnerPartyId = searchParams.get("instanceOwnerPartyId")!;
    }

    const response = await makeLoggedRequest({
      method: "GET",
      url: `${ALTINN_APP_API_URL}/instances`,
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

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromRequest(cookieHeader);

  if (!session.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!ALTINN_APP_API_URL) {
    return NextResponse.json(
      {
        error:
          "App API not configured. Set ALTINN_ORG and ALTINN_APP_NAME in .env",
      },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const response = await makeLoggedRequest({
      method: "POST",
      url: `${ALTINN_APP_API_URL}/instances`,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: body,
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.response?.data || error.message },
      { status: error.response?.status || 500 },
    );
  }
}

