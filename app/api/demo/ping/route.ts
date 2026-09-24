import { NextResponse } from "next/server";
import { pingLLM } from "@/lib/llm";

/** Demo pre-flight: is the AI API reachable, and how fast right now? */
export async function POST() {
  return NextResponse.json(await pingLLM());
}
