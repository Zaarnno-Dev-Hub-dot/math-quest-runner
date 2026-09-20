# Math Quest Runner

2D pixel-art math platformer MVP — a Godot jungle runner that gates progress behind elementary math problems.

## Status (honest)

**Early Godot MVP**, not a finished commercial game.

- Godot project under `godot/` with player, L1 scaffolding, and basic scripts (`player.gd`, `gremlin.gd`, `L1.tscn`, `project.godot`)
- Product intent in `PRD.md` (grades 1–5, three levels, Supabase auth/leaderboard — largely still backlog)
- Sprint board in `TASKS.md`: L1 art prototypes done; L2/L3, math gates, Supabase, leaderboard, and HTML5 demo still open

Expect incomplete levels, placeholder systems, and docs that describe the target product more than the playable build.

## Features (current vs planned)

| Area | Now | Planned |
|------|-----|---------|
| Engine | Godot 4.x project files | Polished export builds |
| Levels | L1 scaffolding | L2 ruins, L3 river canopy |
| Math | Spec / backlog | Coin & gremlin problem gates |
| Backend | Spec only | Supabase auth, sessions, leaderboard |

## Quick start

1. Install [Godot 4.x](https://godotengine.org/) (4.3+ recommended; open `godot/project.godot`).
2. Clone and open:

```bash
git clone https://github.com/Zaarnno-Dev-Hub-dot/math-quest-runner.git
cd math-quest-runner
# Open godot/project.godot in Godot, then run the main/L1 scene
```

3. See `PRD.md` and `TASKS.md` for scope and remaining work.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Zachary Arnold.

Anyone may use, modify, and redistribute this project under the MIT terms.
