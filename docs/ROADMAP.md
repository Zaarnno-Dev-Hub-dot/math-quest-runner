# Roadmap

## Done (v0.1)
- [x] Playable game in the browser: 3 levels x 5 grades, hearts, double-jump, star coins, gremlins, stars and best times.
- [x] Question generator for grades 1-5 (add/subtract, times tables, division, multi-digit multiplication, fractions, decimals, order of operations, word problems), checked by `npm test`.
- [x] Seeded level generator; a bot proves every level (and 180 other seeds) can be finished.
- [x] Touch controls, pause, sound effects, saved progress.

## Done (v0.2)
- [x] Background music per level (original, generated in code), with its own on/off button.
- [x] Moving platforms in levels 2 and 3 (sliding, ferries over gaps, bobbing), optional so every level stays finishable.
- [x] A "why" hint after a wrong answer: the reason for that mistake plus a worked solution, for every topic.

## Next
- [ ] Crumbling platforms.
- [ ] More question variety.
- [ ] Optional login and a global leaderboard (Supabase, see `docs/PRD.md`).
- [ ] Teacher/parent view: which questions were missed.
- [ ] Voice-over for young readers.