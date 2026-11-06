# Obligation Event

A stateless test template whose model declares a concrete `Obligation` event
(`FulfillmentObligationEvent`). Used to cover the processor path that populated
the required `contract` back-reference on emitted obligation events before
they are validated — see `TemplateArchiveProcessor.populateObligationBackReferences`.
