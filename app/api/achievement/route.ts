import { NextResponse } from "next/server";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type CachedYear = {
  at: number;
  items: string[];
};

const YEAR_CACHE = new Map<number, CachedYear>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get("year");
    const year = Number.parseInt(yearParam ?? "", 10);
    const forceParam = url.searchParams.get("force");
    const force = forceParam === "1" || forceParam === "true";

    if (!Number.isFinite(year) || year < 0) {
      return NextResponse.json({ error: "Invalid or missing year" }, { status: 400 });
    }

    const now = Date.now();
    const cached = YEAR_CACHE.get(year);
    if (!force && cached && now - cached.at < CACHE_TTL_MS) {
      return NextResponse.json({ year, items: cached.items }, {
        headers: { "Cache-Control": "public, max-age=0, s-maxage=86400" },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing GEMINI_API_KEY" }, { status: 500 });
    }

    const body = {
      contents: [
        {
          parts: [
            {
              text: `Return a strict JSON array (no code fences) of up to 5 short strings, each describing one of the most important widely-recognized achievements or events that happened in the year ${year}. Each entry must be concise (<= 16 words), factual, and not include the year or numbering. Output ONLY a JSON array of strings.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 256,
      },
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: "Upstream error", detail: text }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: "No content returned" }, { status: 502 });
    }

    const items = coerceToStringArray(rawText).slice(0, 5);
    if (items.length === 0) {
      return NextResponse.json({ error: "Empty content" }, { status: 502 });
    }

    YEAR_CACHE.set(year, { at: now, items });
    return NextResponse.json({ year, items }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=86400" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

function coerceToStringArray(text: string): string[] {
  // Try strict JSON parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === "string").map(normalizeItem);
    }
  } catch {}

  // Try to extract an array substring
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => typeof v === "string").map(normalizeItem);
      }
    } catch {}
  }

  // Fallback: split by lines or bullets
  return text
    .split(/\r?\n|•|-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeItem)
    .slice(0, 10);
}

function normalizeItem(s: string): string {
  // Remove leading numbering like "1. " or "- " if present
  return s.replace(/^\d+\.|^[\-•]\s*/, "").trim();
}


