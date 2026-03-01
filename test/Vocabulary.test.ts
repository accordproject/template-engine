import { ModelManager } from "@accordproject/concerto-core";
import { VocabularyManager } from "@accordproject/concerto-vocabulary";
import { TemplateMarkInterpreter } from "../src/TemplateMarkInterpreter";

describe("Vocabulary Integration", () => {
  it("should prepend localized label when vocabulary is provided", async () => {
    const modelManager = new ModelManager();

    modelManager.addCTOModel(`
      namespace org.example

      concept Sample {
        o String name
      }
    `);

    const vocabManager = new VocabularyManager();

    (vocabManager.addVocabulary as unknown as (arg: unknown) => unknown)({
      namespace: "org.example",
      locale: "fr",
      declarations: [
        {
          name: "Sample",
          properties: [
            {
              name: "name",
              label: "Nom",
            },
          ],
        },
      ],
    });

    const interpreter = new TemplateMarkInterpreter(modelManager, {});

    const templateMark = {
      $class: "org.accordproject.commonmark@0.5.0.Document",
      nodes: [
        {
          $class: "org.accordproject.templatemark@0.5.0.ClauseDefinition",
          name: "top",
          elementType: "org.example.Sample",
          nodes: [
            {
              $class: "org.accordproject.templatemark@0.5.0.VariableDefinition",
              name: "name",
              elementType: "String",
            },
          ],
        },
      ],
    };

    const data = {
      $class: "org.example.Sample",
      name: "Alice",
    };

    const result = await interpreter.generate(templateMark, data, {
      locale: "fr",
      vocabularyManager: vocabManager,
    });

    const valueNode = result.nodes[0].nodes[0];

    expect(valueNode.value).toBe("Nom: Alice");
  });
});
