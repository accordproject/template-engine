# Agent Guidelines for Template Engine

Guidelines for AI coding agents, and the people using them, contributing to
`@accordproject/template-engine`. The engine turns TemplateMark plus JSON data into
AgreementMark, and runs template logic. Read [README.md](README.md) and the files in
[docs/](docs/) as well.

## Before you open a pull request

1. **Run `npm test`.** Its `pretest` step runs the licence-header check (`licchk`),
   `eslint` and the TypeScript build, then Jest runs the unit tests in `test/`.
   Fix every lint and type error.
2. **Run `npm run test:e2e`** when you change template execution, imports or the
   LLM executors.
3. **Add or update tests** for the behaviour you change, including the edge cases
   (empty, null, unusual input), not only the case in the issue.
4. **Say what you ran** in the PR description: the commands and the number of passing
   tests.
5. **Link the issue** the PR closes. Search open and merged PRs and issues first, and
   if one already covers the same fix, say how yours differs or help there instead.

## Commits and pull requests

- Commit messages and PR titles use the
  [Accord Project format](https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md#commit-message-format):
  `type(scope): description`. Types: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `chore`.
- Every commit needs a DCO sign-off (`git commit --signoff`) whose name and email
  match the commit author.
- New source files in `src/` start with the Apache 2.0 header in [HEADER](HEADER);
  `npm run licchk` checks it.
- Keep each PR to one change. Don't include unrelated formatting, refactoring or
  another PR's commits.
- Follow the Accord Project AI usage policy in
  [techdocs](https://github.com/accordproject/techdocs): say in the PR if an AI tool
  helped, and check the output yourself.
- If this is your first contribution, CI workflows wait for a maintainer to approve
  them. That is expected.

## Text output and locale

Templates are not necessarily written in English, and the text the engine produces
(drafting of durations, periods, dates, numbers, units, plurals, lists) has to work
for other languages.

- **Don't hardcode English** words, plural or singular forms, word order, separators
  or date and number formats in drafting or formatting code. Plural rules and word
  order differ by language.
- **Take the locale from the engine** and use locale-aware APIs (for example
  `Intl`) or terms from the model's Concerto vocabulary. If the engine does not yet
  provide the locale or vocabulary you need, say so in the PR and ask a maintainer
  how to proceed instead of adding an English-only table.
- **Test with more than one locale** when output text changes, including one whose
  plural or word-order rules differ from English.

## Read earlier work first

Many areas of the engine have a design history. Before you change a file, read:

- earlier PRs and issues that touched it (`git log -- <path>`, then search the repo),
  including closed ones and unresolved review threads;
- maintainer comments there. They record design decisions, for example the Duration
  drafter discussion in #52 and #217.

In the PR description, say which earlier discussions you read and how your change fits
them. A tidy, well-tested change that takes the wrong approach will not be merged.

## Reviewing

For reviewers, human or agent:

1. **Read earlier PRs and threads on the same files first.** Unresolved maintainer
   design comments are the specification for the change.
2. **Ask whether it is the right solution before whether the code is right.** Check
   the layer (engine, drafter, vocabulary, locale) as well as the logic.
3. **Check any change to user-visible text for locale.** Hardcoded English is a
   design finding, not a nit.
4. **Don't ask a maintainer to approve** until the approach has been checked against
   those earlier comments.
5. Check the usual items: tests for edge cases, public API and type changes in
   `src/index.ts` and `lib/index.d.ts`, licence headers, DCO sign-off, and that the
   PR is one change.
