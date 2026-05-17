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

    const system = `Kamu adalah Brand Strategist Indonesia. Jawab HANYA dengan JSON valid satu baris. Tidak ada teks lain, tidak ada backtick, tidak ada markdown, tidak ada newline di dalam string.

Ikuti format JSON ini PERSIS:
{"opening_line":"1 kalimat personal sebut nama bisnis industri durasi","diagnosis_p1":"2 kalimat kondisi brand sekarang berdasarkan jawaban user","diagnosis_p2":"2 kalimat akar masalah dan peluang spesifik","minggu1":{"tema":"judul singkat","icon":"🎯","focus":"1 kalimat fokus","actions":["action spesifik 1","action spesifik 2","action spesifik 3","action spesifik 4"]},"minggu2":{"tema":"judul singkat","icon":"📱","focus":"1 kalimat fokus","actions":["action 1","action 2","action 3","action 4"]},"minggu3":{"tema":"judul singkat","icon":"🔥","focus":"1 kalimat fokus","actions":["action 1","action 2","action 3","action 4"]},"minggu4":{"tema":"judul singkat","icon":"📈","focus":"1 kalimat fokus","actions":["action 1","action 2","action 3","action 4"]},"prioritas":["tindakan konkret hari ini 1","tindakan 2","tindakan 3"],"kompetitor_analisis":[{"nama":"Nama Brand Nyata","url":"instagram atau website","kelebihan":"kelebihan singkat","kelemahan":"kelemahan singkat","peluang":"peluang untuk bisnis user"}],"kompetitor_riset_mandiri":true,"pesan_personal":"1-2 kalimat hangat dan personal"}`;

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
        system: system,
        messages: body.messages,
      }),
    });

    const data = await response.json();

    // Clean response on server side
    if (data.content && Array.isArray(data.content)) {
      data.content = data.content.map(block => {
        if (block.type === "text" && block.text) {
          let text = block.text;
          // Remove backticks and markdown
          text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
          // Extract JSON between first { and last }
          const first = text.indexOf("{");
          const last = text.lastIndexOf("}");
          if (first !== -1 && last !== -1) {
            text = text.slice(first, last + 1);
          }
          // Remove all newlines and extra spaces
          text = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
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
