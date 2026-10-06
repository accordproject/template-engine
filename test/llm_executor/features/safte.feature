@stateless @safte
Feature: SAFTE
  As a developer maintaining Accord Project templates
  I want to run one stateless template through both the TypeScript
  (logic-only) executor and the LLM (force) executor
  So that I can have an LLM judge confirm their outputs are semantically
  equivalent.

  Scenario: Run the token share request
    Given the stateless template "safte"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent

  Scenario: Equity financing converts the purchase amount at the discounted share price
    Given the stateless template "safte" using sample "sample.json" and request "request-equity.json"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent

  Scenario: Dissolution event pays out the purchase amount instead of issuing shares
    Given the stateless template "safte" using sample "sample.json" and request "request-dissolution.json"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent
