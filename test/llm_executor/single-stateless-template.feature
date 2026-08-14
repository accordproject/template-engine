Feature: Single stateless template — logic vs LLM executor equivalence
  As a developer maintaining Accord Project templates
  I want to run one stateless template through both the TypeScript
  (logic-only) executor and the LLM (force) executor
  So that I can have an LLM judge confirm their outputs are semantically
  equivalent.

  Scenario: Compare the logic-only baseline against the LLM-backed output for one template
    Given the stateless template "copyright-license"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent
