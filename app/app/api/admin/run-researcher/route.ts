import { NextResponse } from "next/server";

export async function POST() {
  const webhookUrl = process.env.RESEARCHER_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "RESEARCHER_WEBHOOK_URL not configured" },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COOLIFY_WEBHOOK_SECRET ?? ""}`,
      },
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return NextResponse.json({ success: true, message: "Researcher triggered" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
