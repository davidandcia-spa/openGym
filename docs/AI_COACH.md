# AI Coach

This fork adds an OpenAI-backed coach on top of openGym's existing deterministic progression engine.
The progression engine still decides the normal load/reps targets. AI Coach reads a compact copy of your
training context and gives recommendations; it does **not** silently rewrite workouts or routines.

## Setup

1. Create a project API key in the OpenAI Platform.
2. Copy the environment template:

```bash
cp .env.example .env
```

3. Add the key to `.env` on the machine that runs openGym:

```bash
OPENAI_API_KEY=your_project_key_here
OPENAI_MODEL=gpt-5.6-luna
```

`gpt-5.6-luna` is the default for lower-cost everyday coaching. You can change `OPENAI_MODEL` without
changing the app code.

4. Build this fork's containers and start openGym:

```bash
docker compose up -d --build
```

Do not use the upstream prebuilt openGym images for this fork; `docker-compose.yml` intentionally builds
`api` and `web` from the local source so the AI Coach changes are included.

5. Open openGym, sign in with a passkey, and tap **AI Coach** on Home.

## What is sent to OpenAI

When you ask the coach a question, the browser builds a compact training context containing:

- unit and body-weight goal;
- recent body-weight entries;
- weekly schedule and recent day overrides;
- routines and exercise targets;
- up to 12 recent workouts, including logged sets and RIR/RPE when present;
- the active workout, if one is running;
- the latest few messages in the Coach conversation.

The OpenAI API key stays server-side. It is never returned to the browser and should never be committed
to Git. `.gitignore` excludes `.env` and runtime `data/` files.

## Cost controls

The API gateway currently limits each signed-in profile to 12 Coach requests per minute and caps each
request body. The default model is chosen for cost-sensitive use. The coach response is also capped in
length.

## Security / runtime data

`./data` contains profiles, public passkey material, per-user state, session secrets and push keys. It is
runtime data, not source code. Back it up on the host, but do not commit it.

The fork keeps only `data/.gitkeep` in Git. On first start openGym creates fresh runtime secrets and data
inside the mounted `./data` directory.
