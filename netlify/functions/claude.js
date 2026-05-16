exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    // Force the correct system prompt jika tidak ada
    const systemPrompt = body.system || "Output JSON only";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: body.messages,
      }),
    });

    const data = await response.json();

    // Clean the text content before returning
    if (data.content && Array.isArray(data.content)) {
      data.content = data.content.map(block => {
        if (block.type === "text" && block.text) {
          let text = block.text.trim();
          // Remove backticks/markdown
          text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          // Extract JSON object
          const first = text.indexOf("{");
          const last = text.lastIndexOf("}");
          if (first !== -1 && last !== -1) {
            text = text.slice(first, last + 1);
          }
          // Replace literal newlines with space to make JSON parseable
          text = text.replace(/\n/g, " ").replace(/\r/g, "");
          block.text = text;
        }
        return block;
      });
    }

    return {
      statusCode: response.ok ? 200 : response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
