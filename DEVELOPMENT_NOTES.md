# OpenAgent Development Notes

## Current State (2026-05-04)

### Implemented Features
- Intelligent link clicking via agent (multilingual - any language works)
- Action tags system: `<action>click:N</action>`, `<action>scroll:up/down</action>`, `<action>navigate:URL</action>`
- Agent receives numbered link list in page context
- Polish language support for action results (actionResultTitle, actionResultSuccess, actionResultFailed)
- Universal navigation patterns (EN/PL)

### Key Files Modified
- `content.js` - `collectPageLinks()`, `page.links.collect` message handler
- `sidepanel.js` - `state.pageLinks`, `collectPageContext()` collects links, `extractNavigationIntent()` simplified
- `background.js` - `buildMessages()` includes link index + action tags system prompt, `parseAndExecuteAction()`, `executeAction()`

### Repositories
- GitHub: https://github.com/radiohost-cloud/openagent
- GitLab: https://gitlab.com/oskarmilton/openagent
- Branches: main, testing (synced)

### Archives (Downloads folder)
- `openagent.tar.gz`, `openagent.zip` (without .git, docs)
- `openagent-testing.tar.gz`, `openagent-testing.zip`

### Known Issues Fixed
- English link references ("go to link", "the first one") now work via agent (no hardcoded patterns)
- "hello" no longer opens as URL
- Polish navigation pattern was universalized

### TODO / Future Work
- Consider adding more languages to action results i18n
- Test action tags with various models on OpenRouter
- Consider streaming support improvements
- Consider adding type action (type:text into input fields)

## Architecture Decisions

### Why Agent-Based Link Handling?
- Multilingual - works in any language
- No hardcoded regex patterns needed
- Agent understands context naturally
- Token efficient - only adds ~200-500 tokens for link index

### Why Action Tags?
- Simple parsing regex
- Language independent format
- Works with any model through OpenRouter
- Easy to extend with new actions
