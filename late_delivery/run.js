const fs = require("fs");
const path = require("path");

const { TemplateArchiveProcessor } = require("../dist/index");
const { Template } = require("@accordproject/cicero-core");

async function test() {
  try {
    const templatePath = ".";

    const template = await Template.fromDirectory(templatePath);

    const processor = new TemplateArchiveProcessor(template, {
      mode: "force", // or "force"
      provider: {
        provider: "groq",
        apiKey: process.env.GROQ_API_KEY,
        model: "openai/gpt-oss-120b",
        temperature: 0,
        maxTokens: 4096,
        topP: 1,
        reasoningEffort: "medium",
        retries: 2,
        timeoutMs: 60000
      },
      verbose: true
    });

    const data = JSON.parse(
      fs.readFileSync(path.join(templatePath, "data.json"), "utf8")
    );

    const request = JSON.parse(
      fs.readFileSync(path.join(templatePath, "request.json"), "utf8")
    );

    console.log("===== DRAFT =====");
    const draft = await processor.draft(data, "markdown", { verbose: false });
    console.log(draft);

    console.log("\n===== INIT RESPONSE =====");
    const initResponse = await processor.init(data);
    console.log(JSON.stringify(initResponse, null, 2));

    console.log("\n===== TRIGGER RESPONSE =====");
    const triggerResponse = await processor.trigger(
      data,
      request,
      initResponse.state
    );
    console.log(JSON.stringify(triggerResponse, null, 2));
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
    if (err && err.stack) {
      console.error(err.stack);
    }
  }
}

test();