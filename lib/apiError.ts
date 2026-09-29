import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotFoundError } from "./leadStore";
import { WorkflowError } from "./workflow";
import { LLMError } from "./llm";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof WorkflowError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof LLMError) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: err.issues },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Something unexpected went wrong." }, { status: 500 });
}
