---
status: approved
---

# Design brief: Tamago Coach

I want a Lens that coaches a beginner (me) through tamagoyaki, the Japanese rolled omelette, while I'm standing at the stove with both hands busy. The hard part of tamagoyaki is timing: pour a thin layer, wait until the top is just barely wet, roll it from the far side toward you, push it back, oil, pour the next layer, repeat. I want the pan itself to tell me when to roll and which way, so I never look at a phone with eggy hands. Most cooking AR puts a timer over the pot; that is the example in the concept video, and it teaches nothing. I want the Lens to teach the roll, so the cue lives on the egg and the pan, and the card says less each layer.

## The one spatial moment
I'm looking down at the tamagoyaki pan on my stove, chopsticks in one hand. On the far rim of the pan a small ring is counting down. It reaches zero: a soft chime, the ring blooms into a card that says "Roll now", and an arrow sweeps across the surface of the egg from the far side toward me. I roll, pinch the big Next button beside the pan, and the pan shows me the next layer's cue. That moment, the roll cue on the pan, is what the Lens is for.

## Why it belongs on glasses
- Uses: draws in the world (the cue sits on the pan, where I'm already looking) and leaves my body free (hands stay on the chopsticks; pinch is the only input). I'm not claiming "shares your view": this version doesn't look at the real pan.
- Why it's better than the phone or laptop version: my eyes stay on the pan at the moment that matters, there's no greasy screen, and the timing cue is in the same place as the thing it's about.

## Product or overlay
- Type: overlay on something real (my stove and pan), but this version senses nothing.
- What the real version would sense: where the pan is, and ideally when the egg is set.
- Stand-in for the preview: the Lens brings its own stove. A virtual counter slab with a real-size tamagoyaki pan on it appears in front of me at start. Because the pan is virtual there is no "found it" button to fake; a grab bar lets me drag the whole set (counter, pan, ring, card, buttons) onto wherever my real stove is. Keep the stand-in obvious: a plain slab and a plain pan, no attempt to look real.
- Simple primitive shapes are fine for everything (slab, pan, egg layer, rolled log, arrow). No generated 3D models needed.

## Where things live
- Where the user is looking during the main task: down at the pan, roughly 70 to 80 cm from my eyes, about 30 to 35 degrees below eye level.
- Stove set (counter slab): 50 × 35 cm, 2 cm thick, centered 70 cm in front of me and 45 cm below eye level at start (default). A 30 × 3 cm grab bar runs along its near edge.
- Pan: rectangular tamagoyaki pan at real size, 13 × 18 cm inside, 3 cm deep, handle to the right (default). Medium grey body with a light rim, not black, so it doesn't vanish on the additive display.
- Timer ring: 6 cm across, standing 2 cm above the pan's far rim, tilted to face me. Step number in the middle, a one-line step title under it.
- Step card: 24 × 12 cm, dark plate with light text, rising from the pan's far rim (bottom edge 4 cm above the rim), tilted about 30 degrees toward me and always facing me (default). Title, one line of instruction, one tip line.
- Roll arrow: a flat arrow 12 cm long lying 1 cm above the egg, pointing from the far side of the pan toward me and animating in that direction. Bright yellow-orange.
- Egg: a flat layer across the pan while a layer cooks, glossy bright yellow when just poured and turning paler and matte as the countdown runs, so I learn what "ready to roll" looks like (default); a rolled log along the near edge that gets thicker after each roll (three sizes); six slices at the end.
- Next and Back buttons: on the counter to the left of the pan, tilted 40 degrees toward me (default) so they don't foreshorten when I look down. Next 8 × 6 cm, Back 6 × 4 cm (default). Both highlight when aimed at.
- Demo ×10 switch: a small toggle at the far-left corner of the counter, labeled "Demo ×10", off by default (default).
- Everything sits inside the view I already have when looking at the pan. Nothing behind me, nothing stuck to my face.

## Hands and input
- Next step: pinch the Next button.
- Previous step: pinch the Back button.
- Pause or resume the countdown: pinch the timer ring (it shows a pause glyph while paused).
- Move the whole set: grab the bar on the near edge, drag, release. It stays where I drop it.
- Demo speed: pinch the Demo ×10 switch; all timers run ten times faster.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: none. No voice. No custom gestures. One hand, pinch only; either hand works.

## When things show
- Step card: expands when a step opens. On a timed step it collapses to the ring and title 6 seconds after the countdown starts (default), expands again when the countdown reaches zero, and stays until I pinch Next.
- Timer ring: visible on every timed step; on Prep it shows just the step number.
- Roll arrow: only during a roll cue, from a layer step's zero until I pinch Next. Gone otherwise.
- Egg layer and log: the flat layer shows while a layer step runs; it joins the log when I pinch Next after a roll cue.
- Readiness cue: over a layer countdown the egg surface goes from glossy wet to matte set, fully matte at zero, so the timer teaches what to look for in the real pan (default).
- Chime: at zero on every timed step, played at the pan (spatial sound), with the ring pulsing three times.
- Done: on the last step at zero, the log becomes six slices and the card says "Done! You've learned the layer, pour, roll cycle."
- If something needs attention out of view: the chime at the pan. If I've looked away, the chime brings me back.

### Steps and timers
1. Prep: beat 3 eggs with 1 tbsp sugar, 1 tsp soy sauce, a pinch of salt. No timer.
2. Heat: oil the pan, medium-low. 1:00. Tip: a drop of egg should sizzle softly. At zero: "Pan's ready. Pour 1/3 of the egg."
3. Layer 1: pour 1/3, tilt to cover, pop big bubbles. 0:30. At zero: "Roll now" plus the arrow.
4. Layer 2: push the roll to the far side, oil, pour the next 1/3, lift the roll so egg flows under. 0:30. At zero: "Roll now" plus the arrow.
5. Layer 3: the card only says "Pour, wait, roll. You know this." 0:30. At zero: "Roll now" plus the arrow. The card says less each layer on purpose; that is how the rhythm sticks (default).
6. Rest & slice: shape it, let it rest. 2:00. At zero: "Slice into 6 pieces. Done!"

## Done criteria
Each one can be checked in Lens Studio's preview.
1. At start I see the counter, the pan and the Prep card beside the pan's far rim, at counter height in front of me. I can walk around it with WASD and it stays put, and the text is readable from where I stand.
2. Pinching Next moves to the next step: the ring's step number and the card title change (Prep → Heat → Layer 1 → Layer 2 → Layer 3 → Rest & slice), and Back goes back one. All six steps are reachable by pinching.
3. On a timed step the ring counts down by itself: the number on the ring is smaller than it was three seconds earlier. Pinching the ring stops it changing; pinching again resumes it.
4. With Demo ×10 on, when Layer 1's countdown reaches zero the card says "Roll now" and the arrow object on the pan is enabled (both assertable in LEAF); the chime I check by ear. After I pinch Next, the arrow is gone and the log in the pan is thicker than before.
5. Grabbing the bar and dragging moves the pan, ring, card and buttons together, and they stay where I release them.

## Out of scope
- Recognizing the real pan or stove, judging egg doneness, voice commands, other recipes, networking, remembering anything between sessions.
- No people, no recording, no identification; it's my own kitchen.

## Risks and open questions
Feel unproven:
- Looking down at the pan for several minutes: comfort unknown until real glasses.
- Hand tracking with greasy or wet hands: unknown; the preview can't show it.
- Chime timing and spatial audio in the preview may differ on the device.
- I'm keeping the 2:00 rest timer as a real cooking value; Demo ×10 exists for demos and tests.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## Build hints from the learner
- Primitive shapes only (boxes, cylinders, a flat arrow built in code). No generated meshes, no asset-library models.
- UI Kit for the card, buttons and switch; SIK Interactable on the ring; grab-and-move on the set's root through the grab bar; the card always faces me.
- Light text on a dark plate, sized for about 75 cm.
- LEAF: one scenario per done criterion, Demo ×10 on in tests, delta assertions for the countdown.

## Scope cuts if time runs out
In this order (default order):
1. Six slices at Done.
2. Egg readiness cue.
3. Egg log thickening.
4. Back button.
5. Pause on the ring.
6. Card auto-collapse.
7. Demo ×10 switch (then shorten timers to 6 seconds for the demo).

Never cut: the six steps, Next, auto-starting timers, the roll arrow on the pan, the virtual pan with its grab bar, and the card text that gets shorter each layer.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
