@stateful @perishable-goods
Feature: Perishable goods — logic vs LLM executor equivalence
  I want to run one stateful template through both the TypeScript
  (logic-only) executor and the LLM (force) executor, initializing each and
  then replaying the same ordered sequence of triggers against it
  So that I can have an LLM judge confirm the full init + trigger sequence
  produces semantically equivalent results

  Scenario: Chained payout sequence across shipment updates with penalty included
    Given the stateful template "perishable-goods" using sample "sample.json" and requests "requests.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent

  Scenario: Late shipment short-circuits before sensor readings are inspected
    Given the stateful template "perishable-goods" using sample "sample.json" and request "request-late.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent
  
  Scenario: Very High Penalty for sensor readings resulting in no payout
    Given the stateful template "perishable-goods" using sample "sample.json" and request "request-high-penalty.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent