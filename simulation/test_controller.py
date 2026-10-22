import unittest
from controller import Controller, MIN_GREEN, MAX_GREEN


class SignalSafety(unittest.TestCase):
    def test_minimum_and_clearance(self):
        c = Controller("adaptive")
        for _ in range(19):
            c.update([0, 50], [0, 100])
        self.assertEqual(c.phase, "green")
        c.update([0, 50], [0, 100])
        self.assertEqual(c.phase, "amber")
        self.assertEqual(c.state([0, 1, 0, 1]), "yryr")
        for _ in range(6):
            c.update([0, 50], [0, 100])
        self.assertEqual(c.phase, "clearance")
        self.assertEqual(c.state([0, 1]), "rr")
        for _ in range(6):
            c.update([0, 50], [0, 100])
        self.assertEqual(c.axis, 1)
        self.assertEqual(c.state([0, 1]), "rG")

    def test_green_cap_and_alternation(self):
        c = Controller("adaptive")
        axes = []
        for _ in range(1200):
            c.update([100, 1], [0, 0])
            self.assertLessEqual(c.elapsed, MAX_GREEN)
            self.assertNotEqual(c.state([0, 1]), "GG")
            if c.phase == "green" and c.elapsed == 0:
                axes.append(c.axis)
        self.assertGreater(len(axes), 10)
        self.assertTrue(all(a != b for a, b in zip(axes, axes[1:])))

    def test_fixed_ignores_demand(self):
        a, b = Controller("fixed"), Controller("fixed")
        for _ in range(200):
            self.assertEqual(a.update([0, 100], [0, 80]), b.update([100, 0], [80, 0]))


if __name__ == "__main__":
    unittest.main()
