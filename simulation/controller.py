"""Deterministic two-axis controller. Durations are seconds; no real-road use."""
from dataclasses import dataclass, asdict

MIN_GREEN, MAX_GREEN, FIXED_GREEN, AMBER, CLEARANCE = 10, 42, 30, 3, 3

@dataclass
class Controller:
    strategy: str
    axis: int = 0
    phase: str = 'green'
    elapsed: float = 0

    def update(self, queues, oldest, dt=0.5):
        self.elapsed += dt
        if self.phase == 'amber' and self.elapsed >= AMBER:
            self.phase, self.elapsed = 'clearance', 0
        elif self.phase == 'clearance' and self.elapsed >= CLEARANCE:
            self.axis, self.phase, self.elapsed = 1-self.axis, 'green', 0
        elif self.phase == 'green':
            other = 1-self.axis
            switch = self.elapsed >= FIXED_GREEN if self.strategy == 'fixed' else (
                self.elapsed >= MAX_GREEN or self.elapsed >= MIN_GREEN and (
                    oldest[other] >= 55 or queues[other]+oldest[other]/12 > queues[self.axis]+oldest[self.axis]/12+1))
            if switch:
                self.phase, self.elapsed = 'amber', 0
        return self.snapshot()

    def snapshot(self):
        return {k: v for k, v in asdict(self).items() if k != 'strategy'}

    def state(self, axes):
        return ''.join('G' if self.phase == 'green' and a == self.axis else 'y' if self.phase == 'amber' and a == self.axis else 'r' for a in axes)
