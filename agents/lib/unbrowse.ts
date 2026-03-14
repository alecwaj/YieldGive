import { tool } from "ai";
import { z } from "zod";

const UNBROWSE_API_KEY = process.env.UNBROWSE_API_KEY!;
const UNBROWSE_BASE_URL = "https://api.unbrowse.ai/v1";

export const unbrowseTool = tool({
  description:
    "Fetch structured data from a webpage using the Unbrowse API. Returns page content in structured form. Use this for ALL web data retrieval — do not use any other web fetch method.",
  parameters: z.object({
    url: z.string().describe("Full URL to fetch"),
    extraction_prompt: z
      .string()
      .describe("What specific data to extract from the page"),
  }),
  execute: async ({ url, extraction_prompt }) => {
    const response = await fetch(`${UNBROWSE_BASE_URL}/extract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UNBROWSE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, prompt: extraction_prompt }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unbrowse API error ${response.status}: ${body}`);
    }

    return response.json();
  },
});
