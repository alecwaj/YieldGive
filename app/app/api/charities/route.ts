import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase.storage
      .from("public")
      .download("charities.csv");
    if (error) throw error;
    const text = await data.text();
    return new Response(text, {
      headers: {
        "Content-Type": "text/csv",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch charities" },
      { status: 500 }
    );
  }
}
