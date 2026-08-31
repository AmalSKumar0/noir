THRESHOLDS = {
    "frameworks": 5,
    "libraries": 5,
    "runtimes": 5,
    "tools": 5,
    "package_managers": 1,
    "configuration": 1,
}

class IdentificationEngine:

    def __init__(self, score):
        self.score = score
        self.result = {
            "language": {},
            "frameworks": {},
            "libraries": {},
            "runtimes": {},
            "tools": {},
            "package_managers": {},
            "configuration": {},
        }

    def identify_category(self, data, threshold):
        return {
            technology: score
            for technology, score in data.items()
            if score >= threshold
        }

    def identify(self):
        for category, threshold in THRESHOLDS.items():
            self.result[category] = self.identify_category(
                getattr(self.score, category),
                threshold
            )

        self.result["language"] = self.score.language

        return self.result

    def display(self):
        for category, technologies in self.result.items():
            print(f"\n{category.upper()}")

            for technology, score in technologies.items():
                print(f"  {technology}: {score}")
