# Thinkbook

A personal notebook inspired by the think-with-you workflow. Write a passage, get a question beside it, and continue the conversation without leaving the page. Includes custom reviewers, note goals, five ink colours, light/dark themes, passage selection, branching diagrams, JSON backup/import, and Markdown export.

## Use GPT inside the notebook

Requires Node.js 18.17 or later. No npm packages need installing.

1. Copy `.env.example` to `.env` in this folder.
2. Set `OPENAI_API_KEY` in `.env` to your own OpenAI project API key. Alternatively set the environment variable before starting.
3. Run `node server.cjs` or `npm start` in this folder. Keep the terminal open.
4. Open the local URL printed in the terminal, normally `http://127.0.0.1:8765`.
5. Select **Enable AI  OpenAI GPT**. Choose a Responses-compatible model available to your API account. The default is `gpt-4.1-mini`.
6. Read the data/billing notice, check the consent box, and select **Use GPT in this notebook**.

Questions, explanations, quizzes, follow-up conversations, and diagrams now use GPT in the page. Connecting checks whether the backend has a key; the first request verifies whether the API account can use that key/model. GPT starts in **When you ask** mode. You may explicitly switch a note to **Thinks with you** afterward; that mode can generate billable calls after a five-second writing pause.

ChatGPT Plus and OpenAI API billing are separate. This app does not use your ChatGPT login, subscription, or ChatGPT session cookies. Do not paste an API key into chat, commit it, or add it to the HTML. The server reads it locally; it is never returned to the browser or included in backups. `.env` is ignored by Git. The server binds only to `127.0.0.1`, validates host/origin, limits requests, and never serves `.env` or backend source files. It is a single-user local service, not a public multi-user deployment.

GPT sends the selected passage, a bounded amount of notebook context, the note goal/reviewer instructions, and recent conversation messages to OpenAI. API requests set `store: false`; that is not a promise of zero retention under every OpenAI policy. Read the API's data policies for your account.

## Local AI without a subscription

Open `Thinkbook_Open.html` directly in current Edge or Chrome. Select **Enable AI  Local AI** and download/load a model. A compatible WebGPU adapter and sufficient memory are required. The model runtime and weights are downloaded from public servers; note inference happens locally. Model quality and speed depend on the selected model and hardware. Models need reloading into memory when the page is reopened, though cached downloads can be reused.

The standalone file cannot call GPT directly, because that would put your secret key in browser code. Use the server edition above for GPT. Copy conversation remains an optional manual fallback.

## Notes and backups

Notes stay in this browser's storage. They are not written to `.env`, server logs, or GitHub. The file edition and server edition have different storage origins: export a JSON backup from one, then import it into the other. Moving the HTML, changing browser, or clearing browser data can hide or erase saved notes, so export backups regularly. Import adds notes and accepts the earlier Thinkbook backup format. Never commit private notebook backups.

## Develop and verify

```text
npm test
npm run build
npm start
```

The tests mock OpenAI responses; they do not incur API charges. A valid API key and credit are needed for a live GPT check. Real WebGPU inference must be checked on the intended device. The notebook is an independent implementation, not Riddled's private service or model.

Official references:
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/reference/overview
- https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- https://webllm.mlc.ai/docs/user/get_started.html

