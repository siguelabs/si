#!/usr/bin/env python3
"""Render the README's illustrative overnight workflow.

Optional development dependency: Pillow (``python3 -m pip install Pillow``).
Run from any directory: ``python3 scripts/render_workflow.py``.
The generated diagram is an illustration, not an execution recording.
"""

from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageColor, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
WIDTH, HEIGHT = 1100, 680
SCALE = 2

COLORS = {
    "bg": "#080f1c",
    "shell": "#0c1727",
    "panel": "#101f32",
    "card": "#14273b",
    "line": "#2a3c51",
    "text": "#ecf2f8",
    "muted": "#9aacc0",
    "dim": "#6f869f",
    "mint": "#7de3c1",
    "mint_bg": "#173a3b",
    "violet": "#baa5ff",
    "violet_bg": "#2c2946",
    "amber": "#ebcc8b",
}

STAGES = [
    ("Inspect", "Start with the workspace.",
     "Read the project, its current changes and its test setup.",
     "Find concrete blockers before the user leaves."),
    ("Ask while awake", "Choose the work while awake.",
     "Ask consequential questions. Choose a mode for this run.",
     "Resolve the scope and stop conditions before starting."),
    ("Save contract", "Save the agreement.",
     "Record the answers, boundaries and next action locally.",
     "The contract is saved. The user can leave."),
    ("Implement", "Work within the boundaries.",
     "Implement small tasks. Coordinate independent work when useful.",
     "Optional workers · host support required"),
    ("Test + review", "Verify every outcome.",
     "Run focused checks, required checks and a review of the diff.",
     "Record failed or unavailable checks accurately."),
    ("Checkpoint", "Checkpoint. Then continue.",
     "Save the evidence and next action after each completed task.",
     "Repeat while authorized work, time and budget remain."),
    ("Report + stop", "Leave a useful morning report.",
     "Hand off verified results, open work and the reason for stopping.",
     "Resume from the saved contract when work continues."),
]


@lru_cache(maxsize=None)
def font(size, bold=False, mono=False):
    if mono:
        candidates = [
            "/System/Library/Fonts/Menlo.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf",
        ]
    elif bold:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/System/Library/Fonts/SFNS.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/System/Library/Fonts/SFNS.ttf",
        ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size * SCALE)
    # Pillow bundles a scalable default on recent versions.
    return ImageFont.load_default(size=size * SCALE)


def scaled(values):
    return tuple(round(v * SCALE) for v in values)


class Canvas:
    def __init__(self):
        self.image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), COLORS["bg"])
        self.draw = ImageDraw.Draw(self.image)

    def box(self, xy, fill="panel", outline=None, radius=12, width=1):
        self.draw.rounded_rectangle(
            scaled(xy), radius=radius * SCALE,
            fill=COLORS.get(fill, fill),
            outline=COLORS.get(outline, outline), width=width * SCALE,
        )

    def line(self, points, color="line", width=1):
        self.draw.line(
            [scaled(point) for point in points], fill=COLORS[color],
            width=width * SCALE, joint="curve",
        )

    def dot(self, x, y, radius=4, fill="mint"):
        self.draw.ellipse(scaled((x - radius, y - radius, x + radius, y + radius)),
                          fill=COLORS[fill])

    def text(self, xy, value, size=18, color="text", bold=False, mono=False,
             anchor=None):
        self.draw.text(scaled(xy), value, font=font(size, bold, mono),
                       fill=COLORS[color], anchor=anchor)

    def pill(self, xy, label, accent="mint", size=13, width=None):
        x, y = xy
        width = width or (self.draw.textlength(label, font=font(size, mono=True)) / SCALE + 24)
        self.box((x, y, x + width, y + 29), fill=f"{accent}_bg", radius=7)
        self.text((x + 12, y + 7), label, size, accent, mono=True)

    def check(self, x, y, color="mint"):
        self.line([(x - 5, y), (x - 1, y + 4), (x + 7, y - 5)], color, 2)

    def arrow(self, start, end, color="mint", width=2):
        self.line([start, end], color, width)
        x, y = end
        if end[0] > start[0]:
            self.line([(x - 6, y - 5), (x, y), (x - 6, y + 5)], color, width)
        else:
            self.line([(x - 5, y - 6), (x, y), (x + 5, y - 6)], color, width)


def shell(c, stage, tick):
    c.box((18, 18, 1082, 662), fill="shell", outline="line", radius=23)
    c.text((42, 37), "si-overnight", 34, bold=True)
    c.text((44, 82), "Agree the scope. Verify the work. Save the handoff.", 17, "muted")
    c.pill((818, 43), "ILLUSTRATIVE WORKFLOW", "violet", 12, 235)
    c.line([(19, 119), (1081, 119)])

    c.text((43, 149), "RUN PHASES", 12, "dim", bold=True)
    for i, (label, *_rest) in enumerate(STAGES):
        y = 193 + i * 56
        if i < 6:
            c.line([(59, y + 16), (59, y + 40)], "line", 2)
        if i == stage:
            c.box((38, y - 15, 250, y + 25), "mint_bg", radius=9)
            c.dot(59, y + 5, 10, "mint")
            c.text((59, y + 5), str(i + 1), 12, "bg", bold=True, anchor="mm")
        elif i < stage:
            c.dot(59, y + 5, 9, "mint_bg")
            c.check(59, y + 5)
        else:
            c.dot(59, y + 5, 9, "panel")
            c.text((59, y + 5), str(i + 1), 12, "dim", anchor="mm")
        c.text((83, y - 4), label, 17,
               "mint" if i == stage else "muted" if i > stage else "text",
               bold=i == stage)

    c.line([(272, 146), (272, 583)])
    c.text((301, 151), f"PHASE 0{stage + 1}", 12, "mint", bold=True)
    c.text((300, 179), STAGES[stage][1], 31, bold=True)
    c.text((301, 225), STAGES[stage][2], 17, "muted")
    c.box((300, 266, 1058, 554), "panel", "line", 15)
    c.dot(309, 581, 3)
    c.text((322, 572), STAGES[stage][3], 16, "muted")

    c.line([(19, 608), (1081, 608)])
    c.text((44, 629), "Illustrative workflow · scope, permissions and host limits apply", 14, "dim")
    c.text((1038, 629), f"0{stage + 1} / 07", 14, "mint", mono=True, anchor="ra")
    c.box((300, 649, 1058, 652), "line", radius=1)
    progress = (stage + (tick + 1) / 8) / len(STAGES)
    c.box((300, 649, 300 + 758 * progress, 652), "mint", radius=1)


def inspect(c, tick):
    c.text((324, 287), "WORKSPACE / READ-ONLY PREFLIGHT", 14, "dim", mono=True)
    rows = [
        ("Project instructions", "scope & conventions"),
        ("Current changes", "preserve user edits"),
        ("Tests & tools", "find available checks"),
        ("Access & blockers", "surface missing setup"),
    ]
    for i, (title, detail) in enumerate(rows):
        y = 337 + i * 52
        active = i <= tick // 2
        c.dot(334, y + 8, 10, "mint_bg" if active else "card")
        if active:
            c.check(334, y + 8)
        c.text((357, y - 2), title, 19, bold=True)
        c.text((1026, y), detail, 16, "muted", anchor="ra")
        if i < 3:
            c.line([(357, y + 33), (1026, y + 33)])


def interview(c, tick):
    for x, accent, heading, lines, chip in [
        (320, "mint", "QUEUE", ("Primary tasks, then", "approved backup tasks."), "An agreed task list"),
        (689, "violet", "DISCOVER", ("Primary tasks, then", "scoped improvements."), "Agreed areas + limits"),
    ]:
        c.box((x, 286, x + 349, 452), "card", "line", 11)
        c.text((x + 20, 303), heading, 15, accent, bold=True)
        c.text((x + 20, 338), lines[0], 21, bold=True)
        c.text((x + 20, 368), lines[1], 21, bold=True)
        c.text((x + 20, 414), chip, 16, "muted")
    c.box((320, 471, 1038, 533), "shell", radius=9)
    c.dot(342 + min(tick, 6) * 2, 502, 4)
    c.text((367, 485), "Ask now", 16, "mint", bold=True)
    c.text((469, 485), "outcomes · checks · permissions · stop time", 17)
    c.text((367, 509), "Wait for the necessary answers before implementing.", 14, "muted")


def contract(c, tick):
    c.text((324, 288), ".si-overnight/<run>/run.md", 18, "mint", mono=True)
    c.pill((935, 283), "SAVED", size=12, width=84)
    c.line([(324, 323), (1034, 323)])
    for i, (label, value) in enumerate([
        ("MODE", "Queue or Discover, chosen for this run"),
        ("SCOPE", "Outcomes, exclusions and task order"),
        ("LIMITS", "Permissions, deadline and known budget"),
        ("CHECKS", "Acceptance criteria and test plan"),
    ]):
        y = 343 + i * 47
        c.text((326, y), label, 13, "dim", mono=True)
        c.text((454, y - 3), value, 19)
        if i <= tick // 2:
            c.check(1020, y + 7)


def workers(c, tick):
    # The side branches are explicitly optional; the main agent owns integration.
    c.box((510, 284, 848, 347), "mint_bg", radius=11)
    c.text((679, 299), "Main agent", 20, "mint", bold=True, anchor="ma")
    c.text((679, 326), "Implement · coordinate · integrate", 14, "text", anchor="ma")
    c.line([(679, 347), (679, 370), (495, 370), (495, 391)], "line", 2)
    c.line([(679, 370), (863, 370), (863, 391)], "line", 2)
    for x, number, detail in [(327, "A", "Owned files / primary task A"),
                               (695, "B", "Owned files / primary task B")]:
        c.box((x, 391, x + 336, 470), "card", "line", 11)
        c.text((x + 18, 405), f"Worker {number}", 20, "violet", bold=True)
        c.text((x + 18, 437), detail, 16, "muted")
    c.line([(495, 470), (495, 490), (863, 490), (863, 470)], "line", 2)
    c.arrow((679, 490), (679, 507), "violet")
    c.text((679, 521), "Review every output · same scope and deadline", 16, "muted", anchor="ma")
    # A small moving packet makes delegation visible without a fake terminal log.
    offsets = [(679, 355), (679, 370), (589, 370), (495, 380),
               (863, 380), (863, 480), (765, 490), (679, 499)]
    c.dot(*offsets[tick], 4, "violet")


def verify(c, tick):
    checks = [
        ("Focused tests", "Verify the changed behavior", "passed"),
        ("Required checks", "Run the project's agreed checks", "passed"),
        ("Diff + scope review", "Inspect correctness and unrelated edits", "reviewed"),
    ]
    for i, (heading, detail, state) in enumerate(checks):
        y = 288 + i * 78
        c.box((320, y, 1038, y + 65), "card", radius=9)
        active = i <= tick // 2
        c.dot(346, y + 32, 12, "mint_bg" if active else "panel")
        if active:
            c.check(346, y + 32)
        c.text((374, y + 10), heading, 20, bold=True)
        c.text((374, y + 39), detail, 15, "muted")
        c.pill((918, y + 18), state if active else "pending", size=12, width=100)


def checkpoint(c, tick):
    c.text((324, 288), "run.md / latest checkpoint", 18, "mint", mono=True)
    c.pill((908, 282), "UPDATED", size=12, width=110)
    c.line([(324, 324), (1034, 324)])
    c.text((327, 342), "TASK", 12, "dim", mono=True)
    c.text((596, 342), "STATE", 12, "dim", mono=True)
    c.text((785, 342), "NEXT / EVIDENCE", 12, "dim", mono=True)
    c.text((327, 378), "Primary task A", 20, bold=True)
    c.pill((584, 372), "done", size=13, width=105)
    c.text((785, 381), "checks recorded", 16, "muted")
    c.text((327, 429), "Primary task B", 20, bold=True)
    c.pill((584, 423), "doing", "violet", size=13, width=105)
    c.text((785, 432), "next approved task", 16, "muted")
    c.box((320, 480, 1038, 532), "shell", radius=9)
    c.text((343, 497), "Read checkpoint", 16)
    c.arrow((484, 506), (518, 506), "dim")
    c.text((541, 497), "Check time + scope", 16)
    c.arrow((718, 506), (751, 506), "dim")
    c.text((776, 497), "Select next task", 16, "mint")
    c.dot(495 + tick * 35, 506, 3)


def report(c, tick):
    c.text((324, 288), ".si-overnight/<run>/report.md", 18, "mint", mono=True)
    c.line([(324, 323), (1034, 323)])
    for i, (x, heading, line1, line2) in enumerate([
        (320, "Outcomes", "What changed", "and what finished"),
        (563, "Evidence", "Checks, results", "and limitations"),
        (806, "Open work", "Blockers, next steps", "and resume context"),
    ]):
        c.box((x, 342, x + 232, 462), "card", radius=10)
        c.text((x + 17, 359), heading, 21, bold=True)
        c.text((x + 17, 399), line1, 16, "muted")
        c.text((x + 17, 425), line2, 16, "muted")
        if i <= tick // 2:
            c.check(x + 207, 371)
    c.box((320, 481, 1038, 533), "mint_bg", radius=9)
    c.text((341, 499), "STOP", 14, "mint", bold=True)
    c.text((405, 498), "Complete · deadline · budget · all blocked · host ends", 17)


RENDERERS = [inspect, interview, contract, workers, verify, checkpoint, report]


def render(stage, tick):
    c = Canvas()
    shell(c, stage, tick)
    RENDERERS[stage](c, tick)
    return c.image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def save_atomic(image, target, **options):
    """Keep the previous complete asset if rendering or saving is interrupted."""
    temporary = None
    try:
        with NamedTemporaryFile(dir=target.parent, prefix=f".{target.stem}-",
                                suffix=target.suffix, delete=False) as output:
            temporary = Path(output.name)
            image.save(output, format=target.suffix[1:].upper(), **options)
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rgb_frames = [render(stage, tick) for stage in range(7) for tick in range(8)]
    # One global palette prevents color flicker. Tiny moving regions plus GIF
    # delta frames keep the README asset small without sacrificing sharp text.
    contact_sheet = Image.new("RGB", (WIDTH, HEIGHT * 7))
    for stage in range(7):
        contact_sheet.paste(rgb_frames[stage * 8 + 7], (0, HEIGHT * stage))
    sampled = contact_sheet.quantize(colors=64 - len(COLORS),
                                     method=Image.Quantize.MEDIANCUT)
    # Preserve small accent marks exactly; a frequency-only palette otherwise
    # spends their entries on the much larger navy surfaces and pale text.
    entries = [channel for value in COLORS.values()
               for channel in ImageColor.getrgb(value)]
    entries += sampled.getpalette()[:3 * (64 - len(COLORS))]
    palette = Image.new("P", (1, 1))
    palette.putpalette(entries + [0] * (768 - len(entries)))
    frames = [frame.quantize(palette=palette, dither=Image.Dither.NONE)
              for frame in rgb_frames]
    # Each stage moves for 700 ms and holds its complete state for 2200 ms.
    durations = [duration for _stage in STAGES for duration in [100] * 7 + [2200]]
    target = OUT / "overnight-workflow.gif"
    save_atomic(frames[0], target, save_all=True, append_images=frames[1:],
                duration=durations, loop=0, optimize=True, disposal=1)
    save_atomic(rgb_frames[-1], OUT / "overnight-workflow.png", optimize=True)
    with Image.open(target) as gif:
        total_ms = sum(gif.seek(i) or gif.info["duration"]
                       for i in range(gif.n_frames))
        print(f"{target.relative_to(ROOT)}: {gif.width}x{gif.height}, "
              f"{gif.n_frames} frames, {total_ms / 1000:.1f}s, "
              f"{target.stat().st_size / 1024:.0f} KiB, loop={gif.info.get('loop')}")
    print((OUT / "overnight-workflow.png").relative_to(ROOT))


if __name__ == "__main__":
    main()
