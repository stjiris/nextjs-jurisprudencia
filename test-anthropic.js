const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ 
  apiKey: "sk-usr-cxx7wrjfo1u0cg71jjs4zjc26n9obj9yxx",
  baseURL: "https://api.iaedu.pt/agent-chat//api/v1/agent/cmoss7l0f658oko01vk2egfpg/stream",
  defaultHeaders: {
    "X-Channel-Id": "cmpfi8l7javpzi601sqgkc95r" 
  }
});
async function main() {
  try {
    const aiResponse = await anthropic.messages.create({
      model: "claude-4-7-opus",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Test" }],
    });
    console.log(aiResponse);
  } catch(e) {
    console.error(e);
  }
}
main();
