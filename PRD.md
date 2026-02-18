# Math Quest Runner – Product Requirements Document (PRD)
Version 2.1 – February 18, 2026
Prepared for: Engineer hand-off
Target platforms: Web (HTML5), iOS, Android (Godot 4.x or Unity recommended)
Backend: Supabase (Auth + Postgres + Realtime)
Scope: MVP with login, 3 visually distinct levels per grade, leaderboard, and full analytics export

## 1. Executive Summary
Math Quest Runner is a delightful, fully player-controlled 2D pixel-art platformer that teaches elementary math through mandatory problem-solving.
Players log in (or play as guest), choose Grade 1–5 → the entire session uses only that grade’s math topic.
No peeking at problems until you physically engage. Double-jump is taught early in Level 1.
Three visually distinct jungle-themed levels keep the experience fresh while reusing the core tileset.
Simple frontend login + Supabase backend stores every result for AI analytics and powers global leaderboards.
15–25 minute sessions that feel like real games.

## 2. Target Audience & Educational Goals
- Ages 6–11 (Grades 1–5)
- Simple controls, large text, color-blind friendly, optional voice-over
- Goal: Automatic recall + conceptual understanding via fun repetition

## 3. Game Structure & Progression
### Login / Auth Screen
- Jungle-themed screen
- “Play as Guest” (local save)
- “Log In” with email/password or Google/Apple (Supabase Auth)
- Up to 3 kid profiles per parent account

### Main Menu
- Grade selector (1–5 with cute icons)
- Leaderboard button
- Progress dashboard
- Settings

### Session Flow
Grade selected → Level 1 → Level 2 → Level 3 → Summary → auto-upload to Supabase → show leaderboard placement

### Win Condition per Level
Reach end flag + ≥8/10 star coins + ≥6/8 gremlin stomps. 3 hearts system.

## 4. Core Gameplay Mechanics
### Controls
- Left/Right + Jump (double-jump unlocked early in Level 1 with tutorial popup)
- Mobile-friendly virtual buttons

### Star Coins & Gremlins
- Blank until engaged (must physically collide/jump)
- Popup or speech bubble appears only on engagement
- Correct = collect/stomp + sparkles
- Wrong = –½ heart

### Double-Jump
Taught in Level 1 after first 3–4 platforms/coins. Available for all subsequent levels and grades.

## 5. Level Design – 3 Levels per Grade
All levels use the exact same lush jungle foreground tileset (platforms, vines, mushrooms, fox, stars, gremlins). Only background layers change for visual variety.

### Level 1 – Sunny Clearing
Bright open jungle, yellow sunlight rays, blue sky. Introduces double-jump early.
(Easiest numbers, static platforms)
[Embed original screenshot: uZ7SD - Sunny Clearing]

### Level 2 – Ancient Ruins
Overgrown mossy stone temples, carved pillars, broken statues in background. Warm golden beams.
(Medium difficulty, moving platforms)
[Embed original screenshot: tEF3P - Ancient Ruins]

### Level 3 – Amazon River Canopy
Platforms over misty river, waterfalls, lily pads, log bridges. Humid blue-green twilight + fireflies.
(Hardest, crumbling platforms, word problems)
[Embed original screenshot: wL381 - Amazon River Canopy]

### Per-Grade Math Topics (locked for whole session)
- Grade 1: Addition & Subtraction
- Grade 2: Add/Sub + Intro Multiplication
- Grade 3: Multiplication
- Grade 4: Multiplication & Fractions
- Grade 5: Fractions, Decimals & Order of Operations

## 6. Audio
Unique background track + SFX per level (Sunny Clearing = upbeat marimba, Ancient Ruins = conga, Amazon River = mystical synth + water).

## 7. Backend & Data (Supabase)
- Full Supabase Auth + Postgres tables for users, kid_profiles, play_sessions
- Every level completion instantly writes: grade, level_name, correct_answers, time_taken, score, etc.
- Ready for AI analytics (most missed questions, progress heatmaps, etc.)
- Guest sessions saved locally, prompt to log in at end to “save your score!”

## 8. Leaderboard
- Global per grade: This Week / All Time
- Rank, Kid Name, Total Stars, Best Time, Accuracy %
- Top 100 + player’s own rank highlighted
- “Share score” image generator

## 9. UI / UX / Polish
- Large kid-friendly fonts
- Rich particle feedback
- Pause, restart, progress dashboard (Supabase-backed)

## 10. Technical Requirements
- 1280×720 base resolution (pixel-perfect)
- Assets: core jungle tileset + 2 new parallax backgrounds (Ruins + River)
- Backend: Supabase only (no custom server)

## 11. Success Metrics
- ≥80% login rate
- Average session ≥18 min
- ≥85% first-play accuracy
- Leaderboard replay motivation