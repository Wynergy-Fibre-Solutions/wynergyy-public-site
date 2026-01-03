export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "No question provided." });
  }

  const systemPrompt = `
You are ACE — the Authoritative Company Explainer for Wynergy Fibre Solutions Ltd.

Rules:
- You explain only.
- You do not advise.
- You do not decide.
- You do not collect data.
- You do not profile users.
- You keep answers concise, factual, and professional.
- You may guide users to Engage or Compliance when appropriate.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Unable to respond.";

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ reply: "ACE is temporarily unavailable." });
  }
}
