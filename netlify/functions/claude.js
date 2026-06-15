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

    const system = `Kamu adalah Brand Strategist Indonesia. Jawab HANYA dengan JSON valid satu objek. Tanpa teks lain, tanpa backtick, tanpa markdown, tanpa newline di dalam string nilai.

Batas karakter PER NILAI (wajib dipatuhi):
- opening_line: max 70 karakter
- diagnosis_p1, diagnosis_p2: masing-masing max 80 karakter
- tema: max 20 karakter
- focus: max 50 karakter  
- setiap action: max 45 karakter
- setiap prioritas: max 50 karakter
- kelebihan, kelemahan, peluang kompetitor: max 55 karakter
- pesan_personal: max 100 karakter

Format JSON (ikuti PERSIS, hanya 1 kompetitor):
{"opening_line":"...","diagnosis_p1":"...","diagnosis_p2":"...","minggu1":{"tema":"...","icon":"🎯","focus":"...","actions":["...","...","..."]},"minggu2":{"tema":"...","icon":"📱","focus":"...","actions":["...","...","..."]},"minggu3":{"tema":"...","icon":"🔥","focus":"...","actions":["...","...","..."]},"minggu4":{"tema":"...","icon":"📈","focus":"...","actions":["...","...","..."]},"prioritas":["...","...","..."],"kompetitor_analisis":[{"nama":"...","url":"...","kelebihan":"...","kelemahan":"...","peluang":"..."}],"kompetitor_riset_mandiri":true,"pesan_personal":"..."}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        temperature: 0,
        system: system,
        messages: body.messages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(errData),
      };
    }

    const data = await response.json();

    if (data.content && Array.isArray(data.content)) {
      data.content = data.content.map(block => {
        if (block.type !== "text" || !block.text) return block;

        let text = block.text;

        // Strip markdown fences
        text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

        // Brace-match dari belakang — handles { di preamble text
        const lastClose = text.lastIndexOf("}");
        if (lastClose > -1) {
          let depth = 0, start = -1;
          for (let i = lastClose; i >= 0; i--) {
            if (text[i] === "}") depth++;
            else if (text[i] === "{") { depth--; if (depth === 0) { start = i; break; } }
          }
          if (start > -1) text = text.slice(start, lastClose + 1);
        }

        // Collapse whitespace
        text = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

        // Validasi server-side
        try {
          const parsed = JSON.parse(text);
          const required = ["diagnosis_p1", "diagnosis_p2", "minggu1", "prioritas", "pesan_personal"];
          const missing = required.filter(k => !parsed[k]);
          if (missing.length > 0) {
            return {
              type: "text",
              text: JSON.stringify({ __error: true, reason: "missing_fields", missing }),
            };
          }
          block.text = JSON.stringify(parsed);
        } catch (e) {
          return {
            type: "text",
            text: JSON.stringify({
              __error: true,
              reason: "invalid_json",
              raw_preview: text.slice(0, 200),
            }),
          };
        }

        return block;
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
