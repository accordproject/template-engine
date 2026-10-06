@stateless @copyright-license
Feature: Copyright license — logic vs LLM executor equivalence
  I want to run one stateless template through both the TypeScript
  (logic-only) executor and the LLM (force) executor
  So that I can have an LLM judge confirm their outputs are semantically
  equivalent.

  Scenario: Run the payment sequence for copyright license
    Given the stateless template "copyright-license" using sample "sample.json" and request "request.json"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent
