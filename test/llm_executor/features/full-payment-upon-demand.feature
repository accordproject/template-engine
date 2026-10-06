@stateful @full-payment-upon-demand
Feature: Full payment upon demand — logic vs LLM executor equivalence
  I want to run one stateful template through both the TypeScript
  (logic-only) executor and the LLM (force) executor, initializing each and
  then replaying the same ordered sequence of triggers against it
  So that I can have an LLM judge confirm the full init + trigger sequence
  produces semantically equivalent results

  Scenario: Full payment lifecycle from demand through settlement
    Given the stateful template "full-payment-upon-demand" using sample "sample.json" and requests "requests.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent

  Scenario: A demand on its own leaves the obligation outstanding
    Given the stateful template "full-payment-upon-demand" using sample "sample.json" and request "request-demand-only.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent
